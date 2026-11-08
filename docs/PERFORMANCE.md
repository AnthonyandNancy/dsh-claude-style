# 性能与流畅度方案

这份文档回答一个问题：在功能、动画、界面与样式都不变的前提下，怎样让 `dsh-claude-style` 在长会话、流式输出和连续输入时不卡。

它不描述当前实现，也不记录进度。机制写在各模块的头注释里，方向性选择写在 `docs/adr/`，可执行的规则写进构建、lint 与测试；这里保留的是各项优化要改哪里、为什么这样改不改变读者看到的东西、以及怎样证明没有改变。

## 前提

- 可见结果不变：同一页、同一会话、同一偏好下，动画的起点、终点、时长与曲线，元素的盒与层级，文字、颜色与圆角，交互的命中区域与键盘路径都与改动前相同。
- 读者可观察的顺序不变：只在绘制前写入的标记仍在绘制前写入；只在批次回调里完成的测量仍不搬进批次回调；滚动位置仍只由滚动主人写。
- 已经成立的约束继续成立：一个观察总线、一个帧管线（D40）；宿主查询只走访问器与清单（D3、D9）；样式只从令牌取值（D9）；功能清单登记它可以被谁读、能否延后（D76）。
- 硬性指标不改动偏好默认值。为了排除机器差异，判断成本一律看同一台机器、同一棵树上的两次运行：一次是改动前，一次是改动后。

## 成本从哪里来

长会话里一帧的时间由四段构成，只有第一段随功能数量增长，后三段随页面规模与样式表规模增长：

1. **分发**：一次页面变化到达 `packages/engine/src/bus.ts` 的一个观察者，再按订阅逐条筛选记录。订阅越多，同一批记录被读的次数越多。
2. **同步**：同一帧里的变化合并成一次 `requestFrame`，随后按安装顺序调用全部功能的 `measure()` 与 `sync()`（`packages/engine/src/scheduler.ts`）。内容列里的变化只跳过声明了 `skipOnContentOnly` 的功能。
3. **读写**：`sync()` 里的 `getComputedStyle`、`getBoundingClientRect`、`scrollHeight` 与 `querySelectorAll` 会让浏览器重新计算样式或布局；一次写入之后再读，代价再付一遍。
4. **合成**：常驻的无限动画、`backdrop-filter`、滤镜与 `will-change` 让合成器持续工作，也让被覆盖的区域更大。

流式输出每秒产生多次 DOM 批次，这四段都按批次数累积；会话越长，第 2、3 段遍历的对象越多。下面的提案分别削减其中一段，互不替代。

## 一、让观察者按目标分片

**现状**：`packages/engine/src/bus.ts` 只保留一个 `MutationObserver`，按所有订阅目标的并集选项挂载；每个批次到达后，`routeRecords()` 从 `mutationSubscriptions.slice()` 开始，遍历全部订阅，逐个调用 `selects()` 过滤记录。当前 49 处订阅里有 33 处观察 `document.body`、16 处观察更小的目标，后者每次都要在同一条页级记录上被判为「不在我的子树里」。

**改法**：总线内部按订阅目标分桶，仍然只用一个观察者与一份全局记录队列。桶的键是订阅的目标节点，值为该目标上的订阅集合；一个批次到达后，先按 `record.target` 找到它所属的已订阅祖先，只把记录交给这些目标桶里的订阅。观察者仍以所有目标的并集选项挂载，因此浏览器侧的观察成本不变；变化的是脚本侧的分发次数。

**为什么可见结果不变**：订阅拿到的是同一批 `MutationRecord`，顺序仍是订阅建立的先后（按 `mutationSubscriptions` 的原始顺序回填，不按桶的顺序），`skipQuiet`、`beforePaint` 与延迟切片语义不变。分桶只减少「一条记录被无关订阅检查」的次数。

**验收**：

- 机制层规范：同一批记录分给三个目标上的订阅，每个订阅只收到落在自己子树里的记录，且顺序与订阅顺序一致。
- `npm run smoke` 的 `scheduler idle once settled` 仍为 0 次 pass。
- 端到端 `longSession` 场景的 p95 帧时与整份文档查找次数不超过 `packages/testing/data/bounds.json` 的现有上限。

## 二、给同步句柄一个「这一帧为什么醒」的输入

**现状**：`schedule()` 只区分「整页」与「只在内容列」。聊天区之外的批次会把所有功能叫醒一遍，即使其中的功能只读聊天区；内容列里的批次又会叫醒不读聊天区的功能，只有 9 个句柄声明了 `skipOnContentOnly`，覆盖 `headerBand`、`viewTabs`、`sidebarStatus`、`sidebarEntries`、`footer`、`dateGroups`、`manualUnread`、`model` 与 `effort`。

**改法**：`schedule()` 接受一个唤醒原因集合（`WakeReason = 'content' | 'sidebar' | 'composer' | 'header' | 'viewport' | 'other'`），原因取自订阅自己的登记。`FeatureHandle` 增加一个可选的 `wakesOn`，列出这个功能的测量与同步需要哪些原因；未声明的功能保持现状，任何原因都唤醒它。调度器检查这一帧的原因集合与 `wakesOn` 是否有交集，没有交集就跳过本轮。`skipOnContentOnly` 保留，原因集合与它是「与」的关系。

**为什么可见结果不变**：这是一条保守的过滤规则——只有功能明确声明「我不读这类变化」才会被跳过；没有声明的功能行为与今天完全相同。跳过的是它读不到任何差异的帧，因此它写出的标记与写出的时刻都不变。

**验收**：

- 机制层规范：一个只声明「聊天内容」的功能在一次侧栏批次里不被调用，在一次聊天批次里被调用。
- 逐功能核对：每加一个 `wakesOn`，在同一页面上把该功能开关各跑一遍冒烟与该功能的 `--feature` 用例，确认标记、盒与动画序列一致。
- 端到端 `longSession` 与 `readerScroll` 均通过。

## 三、把「每轮全量读」改成「变化了才读」

**现状**：输入卡的 `syncComposer()` 每轮重新读全部卡片、附件块与按钮；`placeholder-copy.ts` 每次同步都重扫占位符；聊天折叠每轮遍历全部聊天行；统计每轮重新取全部 meter 与面板。这些工作在页面不变时也会把同样的答案算一遍。

**改法**：给每处「读一遍页面再比对」的循环加输入版次。版次由总线在它所属的观察批次里递增：`MatchList<T>` 新增 `version(): number`，`registryFor` 的回调在 `changed` 分支里把 `registry.version` 加一。折叠按聊天行清单的版次、输入卡按卡片清单的版次、占位符按占位符清单的版次分别判断；版次未变时不再遍历。

**版次只在答案不变的地方可以早退**：早退的前提是「上一轮写下的结果仍在页面上」。输入卡除卡片清单外还读偏好、宿主相位、移动端竖屏层与附件，这些变化不经过卡片清单，所以 `syncComposer()` 在版次未变时仍要执行那些轻量的读写，只跳过「按卡片全量遍历」的那一段；`syncRootMarks()` 与 `syncDraftState()` 这类由偏好与相位决定的写入不能因卡片清单未变而跳过。折叠的读阶段与写阶段各自按版次判断，两者读同一版次，不能互相吞掉对方的一轮。

**为什么可见结果不变**：版次只在会改变答案的批次里递增；那些批次今天会让 `sync()` 读到新值并写出新结果，明天仍然如此。版次不变时，今天会重算的答案与页面上已有的值相同，写入本来就被 `setAttributeIfChanged` 之类的比对挡掉。

**验收**：

- 冒烟：`scheduler idle once settled` 在空闲时仍为 0 次 pass；每个功能开关翻转后仍能完整拆装。
- 机制层规范：版次不变的连续两次 `sync()` 对页面零写入（用页面自己的变更计数读）。
- 端到端：`longSession` 的 p95 帧时比值不随会话长度放大。

## 四、把读取与写入分到两处

**现状**：帧管线已经把 `measure` 与 `sync` 分成两段（`packages/engine/src/frame.ts` 与 `packages/engine/src/scheduler.ts` 的 `read()`／`write()`），但仍有功能在写阶段读布局：`packages/client/src/features/context-stats/session-stats.ts` 在 `sync()` 里调用 `contextMeters()` 与 `contextPanel()`、读 `inline.root()` 并逐个 `querySelector('button')`；`packages/client/src/features/composer/composer.ts` 在 `sync()` 里读宿主相位与视图偏好（`syncRootMarks`）；`packages/client/src/features/composer/placeholder-copy.ts` 在 `syncStandIn()` 里对每张卡片 `querySelector` 判断是否需要占位符；`packages/client/src/features/chat-fold/message-fold.ts` 的 `decide()` 在 `getComputedStyle` 与 `scrollHeight` 上读高度。

**改法**：把这些读取搬进同一功能的 `measure()`，把结果存进该功能的局部变量，`sync()` 只读局部变量并写。`ComposerHandle` 增加 `measure()`，`createPlaceholderCopy()` 的返回对象也增加 `measure(active)`；`composer.ts` 在建好本帧读数后再调用它们。统计把 meter 清单、面板与行节点在 `measure()` 里读好；折叠让 `measure()` 负责判断高度、`sync()` 只应用结果，二者按同一行清单版次推进，并保留「读阶段跑过、写阶段不再读」的既有分支。一个功能若需要两轮信息，就让 `measure()` 在本帧把两轮都读完。

**为什么可见结果不变**：两段仍在同一帧、同一 `requestFrame` 内执行；`measure()` 仍在所有 `sync()` 之前，读到的是其他功能写入之前的布局。搬动只改变读发生的位置，不改变读到的值，也不改变写出的标记。

**验收**：

- 帧管线规范：读阶段不写、写阶段不读（用页面自己的布局读取计数读）。
- `packages/testing/data/document-lookups.json` 的计数只降不升。
- 端到端 `streamPace` 与 `longSession` 通过。

## 五、让常驻动画只花合成器的钱

**现状**：皮肤有多处 `infinite` 动画。`packages/client/src/features/sidebar-status/sidebar-status.css` 的标题扫光改 `background-position`，`packages/client/src/shared/motion.css` 的色流同时改 `background-position` 与 `filter: hue-rotate()`，两者都会触发布局或重绘；`packages/client/src/shared/popover.css` 的 `backdrop-filter: blur(16px) saturate(1.4)` 写在所有卡片上，卡片关闭时仍保留。`will-change` 出现在 `caret.css`、`fold-motion.css`、`swapping-text.css`、`effort-picker.css` 与 `model-picker.css` 五处。页隐藏时 `packages/client/src/theme/chrome.css` 已通过 `data-dsh-claude-asleep` 把全部动画 `animation-play-state: paused`。

**改法**：

- 关键帧只写 `transform` 与 `opacity`。标题扫光由移动渐变改为移动内部高亮层（`translateX`），外层保留 `overflow: hidden` 与既有的 `background-clip: text`；色流的轨道改用 `transform: translate3d`，色相环交给两个叠放的伪元素各占一半透明度、只动 `opacity`。时长、曲线、起止位置与循环次数仍读原令牌。
- `backdrop-filter` 保留同样的半径、饱和度与颜色，但选择器收窄到卡片打开时：所有这类卡片都已经在开合时写 `data-open`（`shared/popover.ts` 的 `setMenuPopoverOpen` 与各功能自己的开合路径），因此不需要新增脚本标记；关闭状态下选择器不命中，合成器不会再为零可见的卡片保留滤镜层。`shared/popover.css` 里 `--dsw-menu-backdrop-filter: none` 的覆盖保持不动。
- 关闭时不再参与动画的 `will-change` 不新增；已有的五处保持不变，只把新增的合成提示写在不改变可见结果的选择器上。

**为什么可见结果不变**：动画的时长、曲线、循环与起止读数来自同一组令牌；改的是浏览器用哪条路径画出中间的帧，中间帧的内容保持一致。扫光与色流的可见范围由外层盒决定，位移层仍被同一盒裁切。`backdrop-filter` 的模糊半径、饱和度与颜色都不改，只改它在关闭时是否还占一层合成。`will-change` 的既有声明一条未动。

**验收**：

- 行为层规范：关闭的卡片 `backdrop-filter` 读作 `none`，打开后不再是 `none`。
- 端到端 `motion` 与 `washLine` 场景通过；`washLine` 仍读到 `dsh-claude-wash-hue, dsh-claude-wash-drift` 两个动画与七层色流。若色流改为两枚伪元素，该场景读到的动画名与层数要随实现一起更新，不能靠放宽断言通过。
- 冒烟：`scheduler idle once settled` 为 0；页隐藏时全部动画处于 paused。

## 六、把首屏不需要的功能移到延后块

**现状**：`packages/client/src/features/*/*.manifest.ts` 中已有 8 个功能声明 `load: 'deferred'`：`ban-screen`、`chat-send`、`context-stats`、`mascot`、`message-actions`、`search`、`settings` 与 `turn-nav`。首屏仍需要、因而留在主产物里的会话导航类功能是 `header-band` 与 `view-tabs`。

**改法**：把「首屏不需要」的功能移进延后块：只有在读者打开设置、搜索、模型选择器或悬停侧栏时才需要安装的功能，其清单改成 `load: 'deferred'`。这份文档的范围内只点 `header-band` 与 `view-tabs` 两个仍然直载的功能；其余功能是否延后要在 `packages/client/src/features/*` 里逐个确认首次可见时刻，不能按「看起来不像首屏」推测。清单是安装次序、样式表顺序与设置行的唯一来源（D76），这条改动只改功能自己的目录。

**为什么可见结果不变**：延后功能在首次需要时安装，安装后的 DOM、标记与样式表与今天相同；差别只在安装时刻。首屏可以看到的功能仍留在主产物里。

**验收**：

- 冒烟：对应功能的 `--feature` 用例通过；`switches` 用例覆盖每个开关的拆装。
- 端到端：打开设置、搜索与模型选择器的场景通过；`shots` 场景的截图与改动前一致。
- 构建：`npm run build` 的导入图检查通过，没有模块被主产物与块同时携带。

## 七、让页隐藏时不止停在动画上

**现状**：`packages/client/src/core/page-visibility.ts` 在页隐藏时写 `data-dsh-claude-asleep`，样式表暂停全部动画；脚本侧的时钟只停了一部分：`packages/client/src/features/home-ripple/home-ripple.ts` 已经订阅 `subscribePageHidden` 并在 `pageHidden()` 时不再排帧，`packages/engine/src/scheduler.ts` 的 60 秒定时器、`packages/client/src/features/chat-wait/chat-wait.ts` 的 250 毫秒轮询、`packages/client/src/features/home/home-store.ts` 的 800 毫秒轮询、`packages/engine/src/scroll-owner.ts` 的 100 毫秒跟随探测，以及 `packages/client/src/features/chat-reveal/chat-reveal.settings.ts` 与 `packages/client/src/features/caret/caret.settings.ts` 的预览定时器，都还在运行。

**改法**：这些时钟统一订阅 `subscribePageHidden`，隐藏时清掉，回来时按原节奏重新起算；`requestFrame` 的调用方在页隐藏时不再排新帧。引擎里的 `scroll-owner.ts` 不认识皮肤的模块（D73），可见性答案经 `packages/engine/src/host.ts` 的访问器与 `packages/engine/src/skin.ts` 的交接缝取得，`packages/client/src/entry.ts` 在 `adoptSkin()` 时把 `pageHidden` 传进去。

**为什么可见结果不变**：页隐藏时读者看不到任何一帧；回来后的第一帧仍按各功能自己的规则重新起算，与今天「动画暂停、回来继续」的语义一致。

**验收**：

- 行为层规范：页隐藏期间 `window.__passes` 不增长；回来后的第一个状态读数与暂停前的状态连续。
- 冒烟：`scheduler idle once settled` 为 0。
- 端到端：`conversation` 与 `longSession` 通过。

## 八、把性能判断固定在两个读数上

上面每一条都要有同一台机器上的前后对照。现有通道已经提供了读数：

- `packages/testing/long-session.mjs` 在一条长会话上跑同一段脚本回答两轮，比较短会话与长会话的 p95 帧时、整份文档查找次数与长任务总时长；上限在 `packages/testing/data/bounds.json`。
- `packages/testing/smoke/probe/settle.js` 读空闲一秒内的调度次数；冒烟的空闲判定为 0。
- `packages/testing/smoke/stand-in/prelude.js` 把页面自己的 `window.requestAnimationFrame` 包了一层，读到的 `window.__passes` 是页面排出的帧数；它是全局计数，用来比较一帧里排了多少任务，不区分调用方。
- `packages/testing/probe-timing.mjs` 在真实宿主上读启动长任务、插件资源与打开模型选择器的耗时。

**验收方式**：每项改动单独跑一次 `node packages/testing/e2e.mjs --scenario longSession`，记下 `rows`、`queries`、`p95` 与 `long tasks` 四个读数；同一台机器、同一棵树、同一 `DSH_LONG_SESSION_TURNS` 下与改动前对照。读数写入提交说明，不写入本文件。

**新增读数**：在上述通道里补两项页面自己记下的计数——一帧内 `measure()` 与 `sync()` 的调用次数，以及一帧内布局读取的次数。两项都由页面在帧管线里累加，测试只读结果；上限加进 `packages/testing/data/bounds.json`，每个上限带理由。

## 思考卡片开合的单帧成本

思考卡片的开合走 `packages/client/src/features/chat-fold/fold-glide.ts` 的折叠门。问题不在门的 200ms 关键帧，而在宿主把整段展开正文插入后的首帧：

- 宿主把展开的思考正文整段插入，正文里有多少段落，浏览器就要为它排多少行。这一笔布局由插入后的第一次绘制完成，皮肤的门只是同一批变化里的一个参与者。
- 门的 `rollOpen()` 需要正文的最终高度来算动画终点，因而是插入后最早读取这段正文的代码之一；但皮肤调度器同一帧的 `measure()` 或浏览器绘制本身也可能先触发布局。把成本全部记在 `rollOpen()` 名下不成立。
- 在替代页、CPU 4 倍节流下，300 段正文的首次打开出现过约 38 至 45ms 的整页布局，长任务约 55 至 125ms；20 段正文约 8ms，1200 段可到约 200ms。关闭方向在正文已经布局时通常低于 10ms。
- 去掉皮肤后的对照页里，插入同样正文并读取最终高度仍要付出约 50ms；把插入与首次读取分开测时，插入本身约 0 至 0.2ms，读取约 20 至 57ms。所以这笔成本主要是宿主内容的首次布局，不是皮肤独有的重复读取；皮肤能决定的是它是否在同一次点击任务里被提前触发。
- 同一正文量下，段落、列表、嵌套列表、代码块与表格的首次读取都随文本量与行数增长（同一节流下约 19 至 57ms），调整 Markdown 结构不能免掉这笔布局。

已经试过并排除的改法：

- 把门的观察订阅改成 `beforePaint`：只能把同一次布局提前，不减少停顿；逐帧高度序列也没有出现未剪裁的完整高度。
- 先写 `height: 0` 再读 `scrollHeight`：写零本身不触发布局，紧接着读取仍会排完整段正文，原型里约 88ms。
- 首帧之后补动画终点：第一帧不再阻塞，但关键帧后移一帧，首帧高度序列与原动画不一致，会改变动效。
- 给插入的正文临时加 `content-visibility: auto`：首读降到约 2ms，但恢复排版仍要一次约 86 至 170ms 的布局；放在动画前后都会制造新的停顿。
- 让每个段落各自 `content-visibility: auto`：首读降到约 10ms，但占位高度改变，最终 `scrollHeight` 从 23716 变成 33616，改变布局。
- 给父级加标记让后代继承跳过排版：`content-visibility` 不继承；把正文分块加含布局容器也不减少总排版量。
- 关闭时缓存正文高度、再次展开直接复用：缓存命中能把门自己的同步高度读取从约 37ms 降到 0，但插入后的首次布局只是改由绘制承担，缓存命中帧的动画进度也会因布局时机不同而偏移，不能保证逐帧一致。
- 在展开的思考行上使用 `row-skip` 的整行跳过：首帧仍会为整段正文排版；恢复排版时会在门落定后出现一次约 88ms 的长任务。

在当前宿主接口与“不改变动效、功能、样式、界面”的约束下，这笔首次布局无法由本仓库消除：宿主没有提供正文最终高度，也没有提供“先收起挂载、再展开”的渲染钩子；任何让插入与起门跨绘制边界、跳过部分排版或改写门关键帧的做法，都会改变读者看到的画面或交互时序。

后续可执行方向只有一个：宿主在会话数据或渲染钩子里提供正文的最终高度，或允许插件参与折叠状态初始化；届时 `rollOpen()` 可以直接取用高度，而不在插入帧读取 DOM。

## 推理窗口与关闭方向

推理窗口的排队帧在读取前先看行是否仍在运行且展开（`reasoning-stream.ts` 的 `readRows()`）；收起或停止的行不会进入高度读取，已有的窗口会由同一帧写阶段撤掉。关闭方向因此在替代页上没有可复现的额外布局读取：300 段正文在 4 倍 CPU 节流下关闭，未见超过 0.5ms 的显式读取或长任务。

真实宿主上的关闭卡顿若仍存在，来源不在折叠门或推理窗口的显式读取，需要按真实宿主会话采样后再定位；当前可用的替代页无法复现。

## 改动边界

- 不新增 `MutationObserver`、`ResizeObserver` 或 `requestAnimationFrame`；新增的观察登记都走 `packages/engine/src/bus.ts` 与 `packages/engine/src/frame.ts`。
- 不新增对宿主服务的按名读取；需要新数据时在 `packages/engine/src/host.ts` 里加访问器，并在 `packages/contracts/src/table.ts` 登记。
- 不新增样式表里的时长、曲线与层级字面值；需要新值时先在 `packages/client/src/theme/tokens.json` 里加一档。
- 不改变偏好默认值与设置页上的任何一行。
- 不改变动画的时长、曲线、起点与终点，不改变元素最终的盒与层级。

## 实施计划

每项提案的任务顺序、要改的文件、失败测试、最小实现、验证命令与提交边界写在 `docs/PERFORMANCE-PLAN.md`。那份计划以读数任务开头，以长会话上限收尾；执行时按任务的步骤逐条勾选，一次提交只带一个逻辑改动。

## 与现有方向的衔接

- 观察总线与帧管线：D40。
- 宿主选择器与清单登记：D3、D76。
- 样式证据与令牌：D9。
- 测试分层、读数与上限：D77。
- 流式输出的跟随：D71。
- 宿主样式规则的改写：D78。
