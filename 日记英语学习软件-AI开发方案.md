# 日记英语学习软件：产品需求与本地原型开发方案

> 文档用途：将本文件与 `画布` 文件夹中的 7 张界面图一起提交给 AI 编程模型，用于生成可运行的本地 Web 原型。
>
> 当前优先级：先完成响应式 Web MVP；微信小程序作为第二阶段，在核心产品流程验证后复用同一套业务数据与服务端接口。

## 1. 产品概述

### 1.1 产品定位

这是一款把“写日记”和“学英语”结合起来的个人学习工具。用户可以使用中文、英文或中英混合文本记录当天经历，再通过 AI 将内容翻译或润色为自然、地道且忠于原意的英文。用户还可以从日记原文或 AI 生成的英文中提取不熟悉的单词和短语，保存到生词本，并结合日记原句进行复习。

产品不是普通翻译器，也不是独立背单词软件。核心价值是：用户用自己真实表达过的内容学习英语，使词汇、表达和语法都带有个人情境，更容易理解和记忆。

### 1.2 核心使用闭环

1. 用户写下中文、英文或中英混合日记。
2. 用户选择“翻译成英文”或“AI 润色”。
3. AI 输出完整、自然的英文日记，同时保留原意、语气、人名、地点和事实。
4. 用户查看原文与英文对照，可接受结果、重新生成或继续编辑。
5. 用户点击英文中的单词或短语查看释义，并将需要学习的内容加入生词本。
6. 生词本保留该词在日记中的原句和来源日期，用户通过卡片和测试持续复习。
7. 学习记录和连续写作天数展示在“我的”页面，形成长期反馈。

### 1.3 目标用户

- 想通过日常写作提高英语表达能力的中文母语学习者。
- 有英文写作需求，但经常遇到“知道意思、不知道如何地道表达”的用户。
- 希望从个人语境中积累词汇，而不是只背通用词表的用户。

### 1.4 MVP 成功标准

- 新用户可在 3 分钟内完成注册、写下第一篇日记并获得英文版本。
- AI 生成内容始终可编辑，且不会覆盖用户原文。
- 用户可从生成结果中选择词汇并保存到生词本。
- 退出并重新登录后，日记、生词和学习进度仍然存在。
- 手机尺寸下可以完成全部核心操作，桌面端也能正常使用。

## 2. 开发范围与阶段划分

### 2.1 第一阶段：本地 Web 原型（本次实现范围）

必须实现：

- 登录、注册和退出登录。
- 日记列表、日记详情、新建、编辑、删除。
- 中文转英文、英文润色、中英混合文本整理为完整英文。
- AI 结果确认、重新生成和手动编辑。
- 从英文日记中选择或批量提取生词/短语。
- 生词本的搜索、筛选、新增、编辑、删除和基础复习。
- AI 助手的对话和历史记录。
- 个人资料、写作统计、词汇统计与基础设置。
- 完整的加载、空数据、错误、无网络和确认弹窗状态。
- 响应式移动端界面，尽量还原提供的设计图。

原型阶段可以使用本地 mock 数据和 mock AI 响应，但数据访问和 AI 调用必须通过统一封装，确保后续能替换成 Supabase 与 DeepSeek，而不需要重写页面。

### 2.2 第二阶段：可上线 Web 版

- 接入 Supabase Auth、PostgreSQL、Storage 和 Row Level Security。
- 接入 DeepSeek API，并加入额度限制、超时、重试、日志和错误处理。
- 部署至 Vercel。
- 增加隐私政策、用户协议、账号注销、数据导出和数据删除。
- 增加邮件或手机号验证、忘记密码及异常登录保护。

### 2.3 第三阶段：微信小程序

- 使用微信开发者工具实现小程序端。
- CloudBase 负责微信登录、openid 获取和云函数入口。
- 小程序不直接访问数据库，也不持有 DeepSeek、Supabase service role 等密钥。
- CloudBase 云函数优先调用统一的 HTTPS 业务 API，由该 API 访问 Supabase 和 DeepSeek，避免 Web 与小程序各维护一套业务逻辑。
- 建立 `openid -> application_user_id` 的账号映射，支持微信账号与 Web 账号绑定。

## 3. 视觉稿与页面映射

AI 编程模型必须先阅读以下设计稿，并以其布局、间距、卡片、圆角、底部导航和粉色强调色为主要视觉依据：

- `画布/登录.png`：登录与注册入口。
- `画布/日记1.png`：日记时间轴列表。
- `画布/日记2.png`：日记详情、原文、英文结果和词汇摘要。
- `画布/日记3-新建.png`：新建日记编辑器。
- `画布/生词本.png`：生词列表、搜索和操作菜单。
- `画布/AI助手.png`：AI 对话首页。
- `画布/我的.png`：个人资料、统计卡片和设置入口。

### 3.1 全局视觉规范

- 优先还原设计稿，不自行改造成通用后台管理界面。
- 页面内容最大宽度建议为 480px；桌面端居中显示，可增加浅色页面背景，但保留手机界面的比例和阅读体验。
- 主背景为白色或接近白色；强调色使用低饱和粉红；正文使用深灰；英文重点词可使用暗红或绿色。
- 卡片采用浅边框、轻阴影、12px 左右圆角。
- 底部导航固定展示：日记、生词本、AI 助手、我的。
- 所有可点击元素应具有 hover、active、focus 和 disabled 状态。
- 支持系统安全区，避免底部导航遮挡 iPhone Home Indicator。
- 图标统一使用同一图标库，避免混用多种风格。

### 3.2 响应式要求

- 以 390×844 左右的手机视口作为首要基准。
- 宽屏下内容居中，不简单把卡片无限拉宽。
- 输入框、按钮和菜单的点击区域至少 44×44px。
- 键盘弹出时，编辑器操作按钮和聊天输入栏仍可访问。

## 4. 信息架构与路由

建议路由：

```text
/login                     登录
/register                  注册
/forgot-password           找回密码（二期可接真实流程）
/diaries                   日记列表
/diaries/new               新建日记
/diaries/[id]              日记详情
/diaries/[id]/edit         编辑日记
/vocabulary                生词本
/vocabulary/[id]           单词详情
/review                    单词复习
/assistant                 AI 助手
/assistant/[sessionId]     对话详情
/me                        我的
/me/profile                个人信息
/me/settings               设置
/me/help                   帮助中心
```

登录后默认进入 `/diaries`。未登录访问业务页面时跳转至 `/login`。底部导航只在登录后的四个一级页面和对应子页面显示；新建/编辑页可以隐藏底部导航以减少干扰。

## 5. 页面与交互规格

### 5.1 登录与注册

依据 `登录.png` 实现验证码登录和密码登录两个标签页。Web MVP 至少提供可用的邮箱/密码注册登录；手机号验证码可以在本地原型中模拟，并明确标注为演示模式。

功能：

- 验证码登录：区号、手机号、获取验证码、验证码输入、下一步。
- 密码登录：手机号或邮箱、密码、显示/隐藏密码、登录。
- 新用户注册、忘记密码、用户协议和隐私政策入口。
- 微信、Apple 等第三方图标在未接入时显示为禁用或“即将支持”，不可伪装成已实现。
- 表单进行前端校验，并展示具体错误，不只显示“登录失败”。

### 5.2 日记列表

依据 `日记1.png` 实现按时间倒序排列的纵向时间轴。

功能：

- 顶部搜索支持搜索标题、原文、英文和词汇。
- 日历按钮打开日期选择器，可跳转到指定日期。
- 每条日记显示日期时间、情绪图标、内容摘要；点击进入详情。
- 右侧悬浮“+”按钮创建新日记。
- 支持按月份分组或连续滚动加载。
- 空状态显示“写下第一篇日记”按钮。
- 长按或更多菜单支持编辑、复制和删除；删除必须二次确认。

情绪值建议采用 `happy / calm / neutral / sad / awful` 五级枚举，不直接依赖图标文本。

### 5.3 新建与编辑日记

依据 `日记3-新建.png` 实现简洁的编辑页。

字段与操作：

- 日期时间，默认当前时间，可修改。
- 情绪选择，可不填。
- 标题，可选；未填写时用正文第一句生成列表摘要。
- 正文编辑器，允许中文、英文和中英混合输入。
- 图片附件，MVP 最多 9 张；本地原型可只做预览和删除。
- “翻译”按钮：主要用于中文或中英混合内容，输出完整英文。
- “AI”按钮：根据文本语言自动选择润色或整理，也可让用户从菜单中明确选择：
  - 翻译成自然英文；
  - 润色英文；
  - 纠正语法并说明；
  - 更口语 / 更简洁 / 更有文采。
- 保存草稿、完成保存。

保存策略：

- 输入后 800ms 自动保存草稿，本地显示“保存中 / 已保存 / 保存失败”。
- AI 操作前先保存当前原文快照。
- AI 结果不得直接覆盖原文，必须显示在独立结果区，由用户选择“采用”“重新生成”或“放弃”。
- 离开有未保存内容的页面时弹出确认提示。

### 5.4 AI 翻译与润色结果

详情页参考 `日记2.png`，自上而下显示：

1. 日记日期、返回按钮、更多菜单。
2. 原文卡片，可编辑。
3. AI 英文卡片，右上角显示 AI 标识。
4. 词汇/短语摘要卡片。

交互：

- 原文与英文默认同时保留，可切换“上下对照”和“只看英文”。
- 用户点击英文单词或选中一段短语时，弹出词义浮层，展示音标、词性、中文释义、上下文释义和加入生词本按钮。
- AI 标出的推荐词只是候选，用户确认后才加入生词本。
- 允许复制英文、朗读全文、重新生成、修改风格和查看修改说明。
- 重新生成后保留历史版本，用户可恢复旧版本。
- AI 失败时保留输入内容，并给出重试按钮。

### 5.5 生词提取规则

AI 返回候选词汇时优先提取对用户有学习价值的词或固定搭配，不要大量收录冠词、代词和极常见词。每个候选项包含：

- `term`：单词或短语原形。
- `phonetic`：音标，可为空。
- `partOfSpeech`：词性。
- `meaningZh`：在当前日记语境下的中文意思。
- `exampleSentence`：日记中的英文原句。
- `sourceDiaryId`：来源日记。
- `difficulty`：easy / medium / hard。

批量提取后先进入确认面板，支持全选、取消选择和逐项编辑，确认后再入库。相同用户下，相同标准化词形默认合并；新的原句作为额外语境保存，不能静默创建重复条目。

### 5.6 生词本

依据 `生词本.png` 实现紧凑列表。

功能：

- 搜索单词、短语、中文释义或来源日期。
- 排序：加入时间、字母顺序、最近复习、掌握程度。
- 筛选：全部、待学习、学习中、已掌握、今日待复习。
- “+”菜单：手动添加、从文本导入；导出可在二期实现 CSV。
- 列表行显示英文、词性、中文释义和掌握状态。
- 点击进入详情，展示发音、释义、日记原句、更多例句、来源日记和复习历史。
- 支持编辑、删除和标记已掌握。

### 5.7 单词复习

MVP 使用简单、可解释的间隔复习，不必第一版实现复杂算法。

- 卡片正面：英文词或短语，可播放发音。
- 卡片背面：中文释义、词性、日记原句和来源日期。
- 用户反馈：忘记、模糊、记得。
- 建议复习间隔：忘记=当天稍后；模糊=1 天；记得=3 天，之后逐步扩展到 7/14/30 天。
- 每次反馈写入复习日志并更新 `next_review_at`。
- 显示今日待复习数量、完成进度和连续学习天数。

### 5.8 AI 助手

依据 `AI助手.png` 实现对话页面。助手专注于英语日记学习，不定位为泛用聊天机器人。

推荐快捷问题：

- “帮我把今天的日记写得更自然。”
- “解释这篇日记中的语法修改。”
- “用今天的生词给我出 5 道题。”
- “和我围绕这篇日记进行英文对话。”

功能：

- 文本输入、发送、停止生成、重新生成和复制回答。
- 可选择关联某一篇日记或一组生词作为上下文。
- 历史记录按会话保存，可新建、重命名和删除会话。
- 图片、语音按钮在 MVP 未实现时显示禁用状态，不做虚假交互。
- 防止把其他用户的数据拼入上下文。

### 5.9 我的

依据 `我的.png` 实现头像、昵称、签名和统计卡片。

建议统计项：

- 已积累生词数。
- 日记/相册数量。
- 已记录天数。
- 连续写作或学习天数。

菜单：个人信息、邀请好友、帮助中心、设置、关于我们。设置至少包含默认 AI 风格、默认显示模式、字体大小、是否自动朗读、数据导出、退出登录。邀请好友在本地原型中只展示占位说明。

## 6. 关键业务规则

### 6.1 日记状态

- `draft`：草稿，允许只有少量文字。
- `completed`：已保存的正式日记。
- `archived`：归档，不在默认列表显示。

删除采用软删除字段 `deleted_at`，以便误删恢复；账号注销时再执行符合隐私政策的最终删除流程。

### 6.2 AI 任务类型

- `translate`：中文/混合文本转自然英文。
- `polish`：润色英文，保留事实与语气。
- `grammar_explain`：给出修改后的文本与关键修改说明。
- `style_rewrite`：按指定风格改写。
- `extract_vocabulary`：提取单词和短语。
- `chat`：英语学习助手对话。

每个 AI 任务都应记录状态：`pending / processing / succeeded / failed / cancelled`。前端必须防止用户连续点击造成重复请求。

### 6.3 AI 输出原则

- 不编造原文没有出现的人、地点、事件和情绪。
- 人名、地名、数字、日期等关键信息必须保留。
- 默认英文程度为自然但不过度复杂，可在设置中选择初级、中级、高级。
- 中文转英文应优先表达自然，而不是逐字直译。
- 英文润色要保留用户个人语气，不自动写成浮夸散文。
- 结果中若有不确定的专有名词，应提示用户确认。

## 7. 数据模型

所有业务表使用 UUID 主键，并包含 `created_at`、`updated_at`。所有用户私有数据必须包含 `user_id`。

### 7.1 `profiles`

```text
id                uuid, 对应 auth.users.id
nickname          text
avatar_url        text nullable
bio               text nullable
english_level     text: beginner/intermediate/advanced
default_ai_style  text
timezone          text
```

### 7.2 `diaries`

```text
id                uuid
user_id           uuid
title             text nullable
original_text     text
original_language text: zh/en/mixed
current_english   text nullable
mood              text nullable
entry_date        timestamptz
status            text: draft/completed/archived
deleted_at        timestamptz nullable
```

### 7.3 `diary_versions`

```text
id                uuid
user_id           uuid
diary_id          uuid
version_type      text: original/translation/polish/manual
content           text
ai_request_id     uuid nullable
is_current        boolean
```

### 7.4 `diary_assets`

```text
id                uuid
user_id           uuid
diary_id          uuid
storage_path      text
asset_type        text: image
sort_order        integer
```

### 7.5 `vocabulary_items`

```text
id                uuid
user_id           uuid
normalized_term   text
display_term      text
phonetic          text nullable
part_of_speech    text nullable
meaning_zh        text
mastery_status    text: new/learning/mastered
review_level      integer default 0
next_review_at    timestamptz nullable
```

对 `(user_id, normalized_term)` 建唯一约束。

### 7.6 `vocabulary_contexts`

```text
id                uuid
user_id           uuid
vocabulary_id     uuid
diary_id          uuid nullable
example_sentence  text
context_meaning   text nullable
```

### 7.7 `review_logs`

```text
id                uuid
user_id           uuid
vocabulary_id     uuid
rating            text: forgot/fuzzy/remembered
reviewed_at       timestamptz
next_review_at    timestamptz
```

### 7.8 `ai_requests`

```text
id                uuid
user_id           uuid
diary_id          uuid nullable
task_type         text
model             text
prompt_version    text
status            text
input_snapshot    text
output_text       text nullable
error_code        text nullable
token_usage       jsonb nullable
```

生产环境需避免在日志中记录不必要的完整隐私文本；`input_snapshot` 是否长期保存应由隐私策略决定。

### 7.9 `chat_sessions` 与 `chat_messages`

```text
chat_sessions: id, user_id, title, related_diary_id nullable
chat_messages: id, user_id, session_id, role, content, status
```

### 7.10 `account_identities`（小程序阶段）

```text
id                  uuid
application_user_id uuid
provider            text: supabase/wechat
provider_user_id    text
```

## 8. 权限、安全与隐私

- Supabase 所有用户私有表启用 RLS，策略至少限制 `user_id = auth.uid()`。
- 前端只使用 Supabase anon key；service role key、DeepSeek API Key 只存在于服务端环境变量。
- Server Action/API Route 不得相信客户端传入的 `user_id`，必须从服务端 session 获取。
- 文件上传校验 MIME、扩展名、体积和用户目录；Storage 路径按用户隔离。
- AI 请求增加单用户频率限制、每日额度、输入长度限制、超时和取消。
- 错误日志隐藏密钥、Authorization header 和完整私人日记。
- 删除、导出、账号绑定等敏感操作需要再次验证身份。
- 在提交 AI 前明确提示：文本会发送给第三方模型服务处理，并提供隐私说明。

## 9. 技术架构

### 9.1 Web MVP 推荐栈

- Next.js（App Router）+ TypeScript。
- React Server Components 用于读取页；交互编辑器和聊天使用 Client Components。
- Tailwind CSS 或 CSS Modules；视觉样式以设计稿为准。
- React Hook Form + Zod 用于表单和输入校验。
- Supabase 用于认证、PostgreSQL 和图片存储。
- DeepSeek API 只从 Route Handler 或独立服务层调用。
- Vercel 部署 Web 与服务端接口。

### 9.2 分层原则

```text
页面与组件
  -> application services（diary、vocabulary、review、assistant）
    -> repository/API client 接口
      -> local mock 实现（原型）或 Supabase/DeepSeek 实现（上线版）
```

页面组件不得直接散落调用数据库或拼接模型 prompt。这样本地 mock、Supabase、DeepSeek 和未来 CloudBase 才能替换而不影响 UI。

### 9.3 建议目录

```text
src/
  app/
    (auth)/login/
    (auth)/register/
    (main)/diaries/
    (main)/vocabulary/
    (main)/review/
    (main)/assistant/
    (main)/me/
    api/ai/
  components/
    layout/
    diary/
    vocabulary/
    assistant/
    ui/
  features/
    auth/
    diaries/
    vocabulary/
    review/
    assistant/
  lib/
    supabase/
    deepseek/
    validation/
    mock/
  types/
```

## 10. AI 接口设计

统一入口示例：`POST /api/ai`

请求：

```json
{
  "task": "translate",
  "diaryId": "uuid",
  "text": "今天下午下过雨……",
  "options": {
    "level": "intermediate",
    "style": "natural",
    "explainChanges": false
  }
}
```

响应应为可校验的结构化 JSON，而不是让前端解析随意格式的 Markdown：

```json
{
  "resultText": "After the afternoon shower...",
  "detectedLanguage": "zh",
  "warnings": [],
  "vocabularyCandidates": [
    {
      "term": "afternoon shower",
      "partOfSpeech": "noun phrase",
      "meaningZh": "午后阵雨",
      "exampleSentence": "After the afternoon shower...",
      "difficulty": "medium"
    }
  ]
}
```

服务端职责：认证、校验、限流、读取必要上下文、拼接版本化 prompt、调用模型、校验输出、记录任务状态并返回。不要把全部历史日记默认发送给模型，只发送当前任务必需的最少上下文。

## 11. 本地原型数据与演示场景

若暂未配置 Supabase 或 DeepSeek，必须提供可用的演示模式：

- 预置 4 篇不同日期和情绪的日记。
- 其中一篇同时包含中文原文、英文译文和 3 个词汇短语，对应 `日记2.png`。
- 预置 12 个生词，包含 new、learning、mastered 三种状态。
- 模拟 AI 调用延迟 800–1500ms，并可通过开发开关模拟失败。
- mock 数据保存在 localStorage 或本地 JSON 数据层，刷新页面后仍保留用户的新增内容。
- README 说明如何从 mock 模式切换到真实服务。

## 12. 状态、错误与无障碍

每个主要页面都要实现：

- 骨架屏或明确加载状态。
- 空状态和主要行动按钮。
- 请求失败状态与重试。
- 保存成功/失败提示。
- 删除和不可逆操作的确认弹窗。
- 防重复提交与禁用态。

无障碍要求：

- 表单有真实 label，图标按钮有 `aria-label`。
- 键盘可以完成主要操作，焦点样式清晰。
- 文字和背景对比度足够，不能只靠红绿颜色表达状态。
- 动画尊重 `prefers-reduced-motion`。

## 13. 非功能要求

- 首屏在常见移动网络下保持轻量；图片使用压缩和懒加载。
- 日记输入优先本地保底，网络失败后不丢失。
- API 返回统一错误结构，例如 `{ code, message, requestId }`。
- 关键流程记录可排查但不泄露隐私的事件日志。
- 所有日期在数据库中保存 UTC，显示时按用户时区转换。
- 中英文混排正确换行，英文段落保留可读行距。

## 14. 暂不纳入 MVP

- 完整社交动态、好友聊天和排行榜。
- 复杂积分、会员、支付和广告系统。
- 自动发布日记或公开社区。
- 大规模通用词典版权数据。
- 复杂语音识别、图片 OCR 和多模态 AI。
- 多端离线冲突合并。

这些功能可以保留入口占位，但不得做成看似可用、实际无响应的按钮。

## 15. 验收标准

### 15.1 核心流程

- 用户可注册/登录并进入日记列表。
- 可新建中文、英文或混合日记，自动保存并在列表出现。
- 点击翻译或润色后，原文不被覆盖，结果可采用或放弃。
- 日记详情可显示原文、英文与候选词汇。
- 用户可将候选词保存到生词本，重复词不会产生重复主条目。
- 用户完成复习后，掌握状态和下次复习时间发生变化。
- AI 助手可选择某篇日记作为上下文并保存会话历史。
- 页面刷新或重新登录后数据仍存在。

### 15.2 UI 与质量

- 7 张设计稿对应页面均有实现，布局和视觉层级基本一致。
- 390px 宽度无横向滚动，底部导航不遮挡内容。
- 所有按钮都有明确反馈，所有失败都可恢复或重试。
- TypeScript、lint 和生产构建通过。
- 至少为日记保存、AI 结果采用、生词去重、复习时间计算编写测试。

## 16. 直接交给 AI 编程模型的执行指令

你是一名资深全栈产品工程师。请根据本文件和 `画布` 文件夹内的 7 张 PNG 设计稿，在当前目录创建一个可运行的 Next.js + TypeScript 响应式 Web 原型。

执行要求：

1. 先检查当前目录和所有设计稿，再开始编码；不要覆盖用户已有文件。
2. 以设计稿为视觉依据，实现登录、日记列表、日记详情、新建/编辑、生词本、复习、AI 助手和我的页面。
3. 第一版默认使用 mock 服务和本地持久化，保证不配置外部密钥也能完整演示核心闭环。
4. 建立清晰的 service/repository 抽象，为 Supabase 和 DeepSeek 留出真实适配层与 `.env.example`，但不要在客户端暴露密钥。
5. AI 模拟结果必须包含英文正文和结构化候选词；UI 必须经过“确认采用”才更新当前英文版本，经过“确认添加”才写入生词本。
6. 实现加载、空数据、错误、禁用、确认弹窗和移动端安全区。
7. 不实现与日记英语学习无关的体重、饮食、运动或健康管理功能。
8. 完成后运行 lint、测试和 production build，修复错误。
9. 在 README 中写明启动命令、页面说明、演示账号、数据存储方式、环境变量和未来接入 Supabase/DeepSeek 的步骤。
10. 最终汇报已实现内容、主要文件、验证结果和仍为 mock 的部分。

