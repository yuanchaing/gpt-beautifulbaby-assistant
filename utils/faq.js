// utils/faq.js
// FAQ 專用工具：不再讀檔，直接內建 FAQ_DATA，避免 Vercel Serverless 檔案路徑問題。

/** @typedef {{ q: string[], a: string }} FAQItem */

/** @type {FAQItem[]} */
export const FAQ_DATA = [
  {
    "q": [
      "營業時間",
      "開門時間",
      "打烊時間",
      "你們幾點開",
      "opening hours",
      "business hours",
      "what time do you open",
      "when do you open",
      "what time do you close",
      "when do you close",
      "what are your opening hours",
      "你們營業時間是"
    ],
    "a": "彼緹娃的開放時間為 09:00–17:00，週一、週二固定休館（連續假期與特別活動將另行公告）。"
  },
  {
    "q": [
      "地址",
      "交通",
      "怎麼去",
      "怎麼到",
      "停車",
      "導航",
      "你們地址在哪",
      "怎麼去你們工廠",
      "有停車場嗎",
      "彼緹娃很遠嗎",
      "address",
      "location",
      "how to get there",
      "how to go",
      "how to get to the factory",
      "how to get to beautiful baby",
      "is there parking",
      "do you have parking",
      "parking info",
      "how to get there by bus",
      "how to get there by public transport"
    ],
    "a": "📍 地址：台南市佳里區民安里同安寮 1-1 號。開車可直接導航「彼緹娃藝術蛋糕觀光工廠」，園區備有停車位；大眾運輸可搭乘橘幹線公車於園區門口下車。"
  },
  {
    "q": [
      "門票",
      "票價",
      "要收費嗎",
      "入場費",
      "免門票嗎",
      "免費",
      "ticket",
      "tickets",
      "ticket price",
      "entrance fee",
      "admission fee",
      "is it free",
      "do I need a ticket",
      "is there an entrance fee"
    ],
    "a": "彼緹娃園區內參觀免門票、免停車費，營業時間內可自由入場。"
  },
  {
    "q": [
      "發票",
      "收據",
      "統編",
      "開立發票",
      "invoice",
      "receipt",
      "tax ID",
      "business receipt",
      "can I get an invoice",
      "can you issue an invoice",
      "can I have a receipt"
    ],
    "a": "彼緹娃消費皆開立電子發票；如需統編請於結帳前主動告知。"
  },
  {
    "q": [
      "導覽",
      "導覽服務",
      "解說",
      "團體導覽",
      "guided tour",
      "tour service",
      "tour guide",
      "group tour",
      "can I book a tour",
      "is there a guided tour",
      "do you provide guided tours"
    ],
    "a": "個人散客可自由參觀彼緹娃；團體或旅行社請提前預約導覽（每場約 10–15 分鐘）。"
  },
  {
    "q": [
      "diy",
      "手作",
      "體驗課",
      "課程",
      "預約 diy",
      "費用",
      "名額",
      "年齡限制",
      "diy class",
      "handmade class",
      "workshop",
      "experience class",
      "how to book diy",
      "diy booking",
      "diy price",
      "diy fee",
      "age limit",
      "age restriction for diy"
    ],
    "a": "DIY 手作課須事先預約（現場額滿為止）。費用與開課時段依課程公告為準；6 歲以下需家長陪同。"
  },
  {
    "q": [
      "團體預約",
      "包場",
      "旅行社對接",
      "校外教學",
      "公司團建",
      "group booking",
      "group reservation",
      "private booking",
      "field trip",
      "school trip",
      "company outing",
      "corporate event",
      "how to book for a group",
      "group tour booking"
    ],
    "a": "20 人以上建議來信或來電洽詢團體預約與時段安排；可提供開立報價單與行程建議。"
  },
  {
    "q": [
      "無障礙",
      "輪椅",
      "嬰兒車",
      "親子友善",
      "accessible",
      "accessibility",
      "wheelchair",
      "stroller",
      "baby stroller",
      "family friendly",
      "is it wheelchair accessible",
      "can I bring a stroller"
    ],
    "a": "館內主要動線設置無障礙坡道並可推嬰兒車；如需協助可洽現場服務人員。"
  },
  {
    "q": [
      "寵物",
      "可帶狗嗎",
      "毛小孩",
      "pet",
      "pets",
      "can I bring my dog",
      "are pets allowed",
      "pet policy",
      "can I bring pets",
      "dog friendly"
    ],
    "a": "戶外空間可攜帶寵物，需繫牽繩；室內展區以寵物推車或提籃為原則，並請自備清潔用品。"
  },
  {
    "q": [
      "餐飲",
      "咖啡",
      "用餐",
      "蛋糕",
      "甜點",
      "預購",
      "生日蛋糕",
      "food",
      "dining",
      "cafeteria",
      "cafe",
      "dessert",
      "cake",
      "birthday cake",
      "can I pre order cake",
      "pre-order cake",
      "what food do you have",
      "do you have desserts"
    ],
    "a": "彼緹娃園區提供咖啡、輕食與自家甜點；生日蛋糕與節慶蛋糕可提前 3–5 天預購，現場數量有限。"
  },
  {
    "q": [
      "付款",
      "支付",
      "刷卡",
      "line pay",
      "apple pay",
      "信用卡",
      "現金",
      "payment",
      "pay",
      "credit card",
      "cash",
      "mobile payment",
      "line pay payment",
      "apple pay payment",
      "what payment methods do you accept",
      "can I pay by card",
      "can I pay by credit card"
    ],
    "a": "提供現金、信用卡與行動支付（如 LINE Pay/Apple Pay），實際可用工具以現場公告為準。"
  },
  {
    "q": [
      "退貨",
      "退款",
      "退費",
      "換貨",
      "保冷",
      "保存方式",
      "return",
      "refund",
      "exchange",
      "how to store",
      "storage method",
      "how to keep the cake",
      "can I return the product",
      "can I get a refund"
    ],
    "a": "食品類商品恕不退換（非瑕疵）。冷藏品請於 0–7℃ 保存並盡速食用；如商品有瑕疵請於當日與客服聯繫。"
  },
  {
    "q": [
      "停班停課",
      "颱風",
      "天候",
      "公告",
      "臨時休館",
      "typhoon",
      "weather",
      "bad weather",
      "temporary closure",
      "closed due to weather",
      "is it open during typhoon",
      "suspension notice",
      "weather announcement"
    ],
    "a": "遇天候或政府公告之停班停課，園區將於官方社群與網站公告是否休館或調整營運時間。"
  },
  {
    "q": [
      "我下一步怎麼做",
      "如何操作",
      "怎麼參加",
      "要怎麼玩活動",
      "第一步要做什麼",
      "what should I do next",
      "what is the next step",
      "how to start",
      "how to join",
      "how to operate",
      "how to use this",
      "how do I start the activity",
      "what should I do first"
    ],
    "a": "加入彼緹娃 LINE 官方帳號 → 點選圖文選單「AR闖關」 → 掃描彼緹娃現場 QRcode → 完成闖關即可獲得一個印章。"
  },
  {
    "q": [
      "如何參加活動",
      "怎麼參加",
      "怎麼玩",
      "闖關玩法",
      "遊戲規則",
      "闖關教學",
      "AR",
      "怎麼開始",
      "參加方式",
      "how to join the activity",
      "how to participate",
      "how to join the event",
      "how to play the game",
      "game rules",
      "how to play ar",
      "how to start ar mission",
      "how to start the ar game",
      "how to participate in ar event",
      "activity guide",
      "ar activity guide",
      "ar game guide",
      "ar event guide"
    ],
    "a": "【AR闖關參加步驟】1️⃣ 加入官方 LINE（掃描現場 LINE QRCode 加入好友）→ 2️⃣ 點擊「AR闖關集章」選擇關卡 → 3️⃣ 開啟手機鏡頭依提示完成任務 → 4️⃣ 完成任務獲得印章 → 5️⃣ 集滿後至「優惠券」查看獎勵並出示 QRcode 使用。"
  },
  {
    "q": [
      "如何集章",
      "要怎麼集章",
      "集章方式",
      "集章活動",
      "集章說明",
      "集章卡",
      "集章任務",
      "集滿印章",
      "印章怎麼拿",
      "集章幾關",
      "stamp",
      "stamps",
      "how to collect stamps",
      "stamp collection",
      "stamp mission",
      "how many stages",
      "how many levels",
      "how to get stamps",
      "how to earn stamps",
      "stamp card"
    ],
    "a": "完成每一個 AR 關卡任務可自動獲得一枚印章，共五個關卡。開啟 LINE 圖文選單 → 點擊「AR闖關」可查看進度；集滿五枚印章即可解鎖所有「AI 食旅合作店家」優惠券。若畫面無法更新，請重新整理或再次開啟「AR闖關」頁面。"
  },
  {
    "q": [
      "優惠券使用",
      "優惠券說明",
      "優惠券在哪",
      "查看優惠券",
      "優惠券兌換",
      "優惠券折扣",
      "兌換優惠",
      "折扣券",
      "店家優惠",
      "怎麼拿優惠券",
      "怎麼用優惠券",
      "哪裡看優惠券",
      "怎樣兌換",
      "怎麼領優惠",
      "coupon",
      "coupons",
      "how to use coupon",
      "how to use coupons",
      "where is my coupon",
      "how to redeem coupon",
      "how to claim coupon",
      "how to get coupons",
      "discount coupon",
      "store coupon",
      "how to redeem the discount"
    ],
    "a": "完成所有 AR 闖關並集滿五枚印章後，即可自動獲得「AI 食旅合作店家」優惠券。於 LINE 圖文選單點選「優惠券」查看；至指定店家消費時出示對應券的 QRcode 供店員掃描即可使用。每張券僅限使用一次，內容與期限以券面為主。"
  },
  {
    "q": [
      "活動到什麼時候",
      "活動結束時間",
      "活動截止日",
      "活動到幾號",
      "什麼時候結束",
      "活動期間",
      "到哪天",
      "活動多久",
      "活動還有嗎",
      "活動什麼時候結束",
      "到年底嗎",
      "還能玩嗎",
      "event period",
      "event duration",
      "until when",
      "when does the event end",
      "when does the activity end",
      "event end date",
      "how long is the event",
      "is the event still available"
    ],
    "a": "AR 闖關集章活動至 12 月 31 日止。請在期限前完成所有關卡並領取優惠券。"
  },
  {
    "q": [
      "AI客服",
      "可以問什麼",
      "要怎麼問",
      "我可以問問題嗎",
      "AI怎麼用",
      "客服在嗎",
      "有人在嗎",
      "AI客服歡迎詞",
      "客服",
      "ai customer service",
      "ai support",
      "can I ask a question",
      "what can I ask",
      "how to use the ai",
      "is anyone there",
      "can I chat with ai",
      "what can this bot do",
      "what can you help with"
    ],
    "a": "您好～😊\n 您可以直接輸入想了解的問題，例如：\n 🕒 想查詢彼緹娃營業時間 → 「營業時間」\n 🎯 想知道怎麼玩 → 「AR闖關怎麼玩？」\n 🎟️ 想知道優惠券怎麼用 → 「優惠券怎麼用？」\n 🍰 想了解配合店家 → 「目前有哪些合作店家？」\n\n 💬 請直接在這裡輸入問題，智能 AI 24 小時隨時為您服務！"
  },
  {
    "q": [
      "活動說明",
      "AR活動說明",
      "AR活動介紹",
      "AR活動玩法",
      "AR活動怎麼玩",
      "AR闖關說明",
      "AR闖關介紹",
      "AR闖關玩法",
      "AR闖關怎麼玩",
      "activity description",
      "event description",
      "ar activity description",
      "ar game description",
      "ar event introduction",
      "how does the ar event work",
      "how does the ar game work",
      "what is this ar activity about"
    ],
    "a": "👉 AR闖關\n選擇「AR闖關」再點選附近對應的AR關卡，開啟手機鏡頭進行AR互動，完成一關即可獲得一個印章，五關都完成再獲得優惠券。\n\n👉 集章活動\n在彼緹娃觀光工廠完成AR闖關，每完成一關可以獲得一個印章，最多獲得五個。\n\n👉 優惠券\n在彼緹娃觀光工廠完成所有的AR闖關，可獲得所有食旅成員店家的優惠券，前往該店家出示優惠券QRCode可直接使用該優惠。\n\n👇 參加方式\n1️⃣ 抵達彼緹娃觀光工廠\n2️⃣ 點擊「AR闖關」點選一個商品開啟相機\n3️⃣ 找到現場對應的商品\n4️⃣ 跟著提示完成闖關\n5️⃣ 闖關完成 前往「活動集章」查看進度\n6️⃣ 五關都通過後 點選「優惠券」查看獎勵\n\n❓有問題嗎？\n直接輸入訊息問 AI 客服\n🕐 24小時幫你解決問題\n\n直接輸入訊息問 AI 客服 24小時幫您解決問題\n"
  },
  {
    "q": [
      "有甚麼商品",
      "有什麼商品",
      "商品列表",
      "甜點種類",
      "推薦商品",
      "彼緹娃商品",
      "彼緹娃甜點",
      "彼緹娃蛋糕",
      "彼緹娃產品",
      "產品種類",
      "產品列表",
      "甜點推薦",
      "蛋糕推薦",
      "彼緹娃推薦商品",
      "主打甜點",
      "人氣商品",
      "products",
      "product list",
      "what products do you have",
      "what cakes do you have",
      "what desserts do you have",
      "recommended products",
      "recommended desserts",
      "recommended cakes",
      "best selling items",
      "popular items",
      "signature products"
    ],
    "a": "🍰 彼緹娃五大明星商品：\n\n• 檸檬巧克力蛋糕：酸甜清爽、造型可愛。\n\n• 波士頓派：卡士達香濃、柔軟細緻。\n\n• 重乳酪蛋糕：濃郁滑順、香氣飽滿。\n\n• 蜜芋頭蛋糕捲：綿密香甜、層次豐富。\n\n• 冰鎮銅鑼燒：綿密口感、清爽涼感。\n\n每款甜點皆為彼緹娃手作烘焙，用心呈現不同風味與季節特色。"
  },
  {
    "q": [
      "現在最推",
      "推薦招牌",
      "建議商品",
      "建議產品",
      "what is your top recommendation",
      "what do you recommend",
      "recommended item",
      "best seller",
      "most popular cake",
      "what is the star product",
      "today's recommendation"
    ],
    "a": "🍋 本月明星商品：檸檬巧克力蛋糕 🍫 外層特級檸檬巧克力，酸甜中帶奶香；內層蛋糕濕潤柔軟、清新不膩口。亮黃色外觀超吸睛，拍照打卡必備！"
  },
  {
    "q": [
      "合作店家",
      "合作單位",
      "食旅合作店家",
      "推薦店家",
      "優惠店家",
      "合作夥伴",
      "合作商家",
      "有哪些店家",
      "有哪些合作店家",
      "有哪些推薦店家",
      "有哪些優惠店家",
      "有哪些合作夥伴",
      "有哪些合作商家",
      "有哪些合作商店",
      "認識食旅成員",
      "食旅成員介紹",
      "AI食旅成員介紹",
      "AI食旅成員",
      "partner shops",
      "partner stores",
      "partner restaurants",
      "cooperating stores",
      "cooperating shops",
      "cooperative partners",
      "which shops are included",
      "which partner shops",
      "which partner stores",
      "who are the ai food tour members",
      "ai food tour members"
    ],
    "a": "💬 AI食旅 成員介紹\n👉 觀光工廠與文創品牌\n👑 國王家族 Kings Family 羽絨服飾觀光工廠\n台灣製羽絨服飾、防風保暖精品\n🏺 上雅禮品（智匠工藝社）\n 創意文創禮品，府城特色紀念品\n🌿 Les OMBRES d’Ambre 香氛工坊\n 天然香氛、手作體驗、療癒香氣滿滿🌸\n\n👉 特色美食與餐飲\n\n🫖 八木茶飲\n在地茶香新風味、手搖茶飲好順口\n☕ 巷隅咖啡 Lane Corner Café\n老宅咖啡香、文青聚落首選\n🐟 日寶食品\n台南水產品牌，專營鱈魚、魩仔魚等海鮮製品\n🌕 佛都愛玉\n天然手作愛玉，安平人氣消暑首選\n🍡 御品紅豆 佳里店\n紅豆湯圓名店，甜而不膩的經典好味\n🍸 鯤島 Khuntor 餐酒館\n在地創意料理，夜晚微醺好去處\n"
  },
  {
    "q": [
      "彼緹娃",
      "彼緹娃蛋糕",
      "彼緹娃觀光工廠",
      "佳里蛋糕工廠",
      "beautiful baby",
      "beautiful baby cake",
      "beautiful baby factory",
      "about beautiful baby",
      "beautiful baby info",
      "factory info",
      "about the cake factory"
    ],
    "a": "🫖 彼緹娃藝術蛋糕觀光工廠\n📍 台南市佳里區同安寮 1-1 號\n📞 (06)723-6320\n🕐 09:00–17:00（週一、週二休館），免門票、備有停車位\n主題：藝術蛋糕、中式囍餅與伴手禮為主題，融合烘焙文化與觀光體驗，提供DIY課程與甜點展售，展現台南在地創新烘焙精神。 \n🔗 官方網站：http://www.beautiful-baby0611.com.tw/"
  },
  {
    "q": [
      "國王家族",
      "Kings Family",
      "羽絨服飾",
      "羽絨工廠",
      "羽絨衣",
      "保暖衣",
      "kings family down",
      "kings family factory",
      "about kings family",
      "kings family info",
      "down jacket factory",
      "kings family down factory"
    ],
    "a": "👑 國王家族 Kings Family 羽絨服飾觀光工廠\n📍 台南市佳里區民安里 2-8 號\n📞 06-721 3380\n🕐 週一～週日 09:00–17:30\n簡介：台南在地的羽絨與機能服飾品牌，主打防風、防水、保暖系列衣著與寢具。園區結合觀光導覽與商品展售，展示台灣製造的高品質工藝與羽絨製程。 \n🔗 https://www.globetrotter.com.tw/pages/kingsfamily-down"
  },
  {
    "q": [
      "巷隅咖啡",
      "Lane Corner",
      "咖啡廳",
      "文青咖啡",
      "lane corner cafe",
      "about lane corner",
      "coffee shop",
      "cafe in tainan",
      "lane corner coffee",
      "lane corner information"
    ],
    "a": "☕ 巷隅咖啡 Lane Corner Café\n📍 台南市東區中華東路三段 399 巷 5 號\n📞 0900 601 605\n🕐 週一～週日 09:00–17:30\n簡介：台南自家烘焙咖啡品牌，從生豆篩選到手沖細節皆講究，空間溫馨明亮，提供輕食與甜點，是午後放鬆與好友聚會的理想場所。 \n🔗 https://lanecorner.qdm.tw/"
  },
  {
    "q": [
      "八木",
      "八木茶飲",
      "桂花烏龍",
      "奶蓋紅",
      "推薦飲品",
      "bamutea",
      "ba mu tea",
      "yagi tea",
      "about bamutea",
      "about 八木 tea",
      "tea shop",
      "tea drink recommendation"
    ],
    "a": "🫖 八木茶飲\n📍 台南市安南區安和路五段 259 號\n📞 06-356 4651\n🕐 週一～週六 07:00–21:30；週日 08:00–21:30\n簡介：起源於台南、邁向全台的手搖品牌，嚴選台灣茶葉，主打Ｑ彈手作粉角飲品，融合現烤厚片與鍋物，為「做事人奉茶」的最佳選擇。\n🔗 https://bamutea.com/"
  },
  {
    "q": [
      "日寶",
      "日寶食品",
      "虱目魚酥",
      "魩仔魚",
      "鯖魚",
      "jih pao",
      "jih pao food",
      "jihpao food",
      "about jih pao",
      "seafood products",
      "fish products"
    ],
    "a": "🐟 日寶食品\n📍 台南市佳里區文北里苓芭寮 5-1 號\n📞 06-726 5180\n🕐 週一～週五 08:00–17:00；週六、週日 休息\n簡介：創立於台南的水產食品製造廠，專營鯖魚、魩仔魚等海鮮製品，以新鮮原料與HACCP、\n🔗 https://www.facebook.com/JihPaoFood/"
  },
  {
    "q": [
      "佛都愛玉",
      "愛玉冰",
      "檸檬愛玉",
      "台南愛玉",
      "fodu aiyu",
      "fodu jelly",
      "aiyu jelly",
      "about fodu aiyu",
      "lemon aiyu",
      "aiyu dessert"
    ],
    "a": "🍋 佛都愛玉\n📍 台南市佳里區成功路 200 號\n📞 06-723 4569\n🕐 週一～週日 09:00–22:00\n簡介：以台灣在地天然愛玉聞名，提供清爽愛玉冰、手作飲品與甜點，結合傳統工法與現代風味，是炎夏消暑與下午茶聚會的好選擇。 \n🔗 https://foduaiyu.tw/"
  },
  {
    "q": [
      "御品紅豆",
      "御品紅豆佳里店",
      "紅豆湯",
      "紅豆冰",
      "甜湯",
      "yupin red bean",
      "yupin dessert",
      "about yupin red bean",
      "red bean soup",
      "red bean dessert"
    ],
    "a": "🍧 御品紅豆 佳里店\n📍 台南市佳里區新生路 409 號\n📞 06-721 1011\n🕐 週一～週日 09:30–21:30\n簡介：台南人氣甜品品牌，以綿密香甜紅豆冰與多樣配料聞名，主打冰品、豆花與剉冰，口感濃郁不膩，是消暑解饞的經典選擇。\n🔗 https://www.facebook.com/red067211011/?locale=zh_TW"
  },
  {
    "q": [
      "上雅",
      "上雅禮品",
      "智匠工藝社",
      "琉璃",
      "獎盃",
      "獎牌",
      "雕刻",
      "shang ya gifts",
      "shangya gifts",
      "zhijiang studio",
      "about shangya",
      "trophy shop",
      "glass art"
    ],
    "a": "🎁 上雅禮品（智廬工藝社）\n📍 台南市佳里區博愛街 111 號\n📞 06-723 2147\n🕐 週一～週五 08:30–18:00；週六、週日 休息\n簡介：在地禮品與工藝品牌，專營琉璃、獎盃、獎牌與雕刻禮品，結合藝術設計與精緻手工，廣受企業與學校選用，提供專業客製化服務。。\n🔗 https://spyge.so-buy.com/front/bin/home.phtml"
  },
  {
    "q": [
      "光影餐廳",
      "Les OMBRES",
      "義大利麵",
      "歐陸料理",
      "葡萄酒",
      "les ombres restaurant",
      "les ombres d'ambre",
      "les ombres d’ambre",
      "about les ombres",
      "western cuisine",
      "european cuisine",
      "wine restaurant"
    ],
    "a": "🍷 Les OMBRES d’Ambre Restaurant 光影餐廳\n📍 台南市中西區和緯路五段 203 號\n📞 06-350 6886\n🕐 週一、週三、週四 10:30–15:00、18:00–22:00；週二 休息；週五 11:30–15:00；週六、週日 11:30–14:30、18:00–22:00\n簡介：台南知名歐陸創意料理餐廳，以光影為設計靈感，提供義大利麵、排餐與精選葡萄酒，結合美食與藝術氛圍，是約會與聚餐的理想選擇。\n🔗 https://lesombres.tw/"
  },
  {
    "q": [
      "鯤島",
      "Khuntor",
      "餐酒館",
      "台南餐酒館",
      "khuntor bar",
      "khuntor bistro",
      "khuntor restaurant",
      "about khuntor",
      "tainan bistro",
      "tainan bar"
    ],
    "a": "🍸 鯤島 Khuntor 餐酒館\n📍 台南市北區東豐路 257 號\n📞 06-208 9453\n🕐 17:00–01:00\n簡介：台南東區質感餐酒館，在地小吃與創意料理融合於調酒與佳餚，適合朋友聚餐與約會。\n🔗 https://khuntor.com/"
  },
  {
    "q": [
      "泰興",
      "泰興肉脯",
      "純肉脯酥",
      "蜜汁豬肉乾",
      "古早味豬肉絲",
      "香辣牛肉乾",
      "杏仁芝麻脆肉乾",
      "佳里伴手禮",
      "taihsing",
      "taihsing meat",
      "taihsing jerky",
      "about taihsing",
      "meat jerky shop",
      "pork jerky",
      "traditional jerky"
    ],
    "a": "🍪 泰興肉脯佳里老店\n📍 台南市佳里區佳西路136號\n📞 06-723 5050\n🕐 週一～週日 09:00–19:00\n簡介：創立於1976 年在地深耕五十年的老字號肉乾專賣店 ☆ 秉持著「用好心腸作好香腸、好心肝作好肉乾」的精神，製作出各式肉乾、肉鬆、肉脯及古早味零嘴。\n🔗 https://taihsing.com/"
  },{
    "q": [
      "DIY 活動需要預約嗎？",
      "DIY 活動怎麼報名？",
      "DIY 活動要預約嗎？",
      "DIY 活動現場報名可以嗎？",
      "DIY 活動預約方式？",
      "DIY 活動如何預約？",
      "do I need to book diy",
      "how to book diy",
      "diy booking method",
      "can I sign up for diy on site",
      "is diy by reservation only",
      "how to reserve diy",
      "diy reservation"
    ],
    "a": "DIY 活動採「預約優先」，現場若有名額也可報名。建議提前預約以確保時段。\n可透過官網預約系統或粉絲專頁，也可來電確認。洽詢電話：06-723 6320"
  },{
    "q": ["DIY 活動多長時間？", "DIY 活動時間？", "DIY 活動多久？", "DIY 活動時長？", "diy duration", "how long is diy", "diy time length", "diy activity duration", "diy activity length", "how long does diy take" ],
    "a": "每場 DIY 活動約 45–60 分鐘，依課程內容略有不同。大部分課程非常適合親子共同參與。"
  },{
    "q": ["DIY 活動費用多少？", "DIY 活動價格？", "DIY 活動收費？", "DIY 活動價錢？", "diy price", "diy cost", "diy fee", "how much is diy", "diy activity price", "diy activity cost" ],
    "a": "DIY 課程費用依主題不同，約 350–450 元不等。包含可使用提供的材料與工具與教學，不需額外費用。\n部分節慶課程價格將另行公告。"
  },{
    "q": ["DIY 成果可以帶回家嗎？", "DIY 作品可以帶回家嗎？", "DIY 成品可以帶回家嗎？", "DIY 作品能帶回家嗎？", "can I take diy home", "can I bring diy home", "diy take home", "diy bring home", "can I keep my diy", "can I keep my diy project"],
    "a": "所有作品皆可現場享用或帶回家，我們會提供簡易包裝盒或袋子，方便攜帶。\n教室所提供的材料與工具則請勿攜帶離開，避免影響下一場DIY活動的流程時間，謝謝。"
  },{
    "q": ["團體可以預約 DIY 嗎？,", "團體可以參加 DIY 嗎？", "團體可以報名 DIY 嗎？", "團體如何預約 DIY？", "can groups book diy", "can groups join diy", "group diy booking", "group diy reservation", "how can groups book diy", "how can groups join diy"],
    "a": "可接受 16–40 人團體預約，可依需求規劃客製課程與場地配置，有專人協助活動安排。\n請提前至少一週以上來電預約，洽詢電話：06-723 6320"
  }
];

// 字串正規化：全小寫、去空白
function normalize(str) {
  return String(str ?? "")
    .toLowerCase()
    .replace(/\s+/g, "");
}

/**
 * FAQ 比對：
 * - 逐一掃過 FAQ_DATA 裡的每個 q 關鍵字
 * - 用「是否互相為 substring」的方式來算分
 * - 分數最高且 >= minScore 的就當作命中
 *
 * @param {string} input 使用者輸入文字
 * @param {{ minScore?: number }} options
 * @returns {string|null} FAQ 回答文字（a），或 null
 */
export function matchFAQ(input, options = {}) {
  const text = normalize(input);
  if (!text) return null;

  const { minScore = 0 } = options;
  const faq = FAQ_DATA;

  let bestItem = null;
  let bestScore = 0;

  for (const item of faq) {
    if (!item || !Array.isArray(item.q)) continue;

    for (const q of item.q) {
      const nq = normalize(q);
      if (!nq) continue;

      let score = 0;

      if (text === nq) {
        // 完全相同
        score = 1;
      } else if (text.includes(nq)) {
        // 使用者句子包含關鍵字
        score = nq.length / text.length;
      } else if (nq.includes(text)) {
        // 關鍵字包含使用者句子（例如關鍵字比較長）
        score = text.length / nq.length;
      } else {
        score = 0;
      }

      if (score > bestScore) {
        bestScore = score;
        bestItem = item;
      }
    }
  }

  if (!bestItem || bestScore < minScore) {
    return null;
  }

  return bestItem.a || null;
}

/**
 * 從 FAQ 中抽取品牌相關摘要，提供給 GPT 當作 context
 *
 * @param {string} vendor 例如「彼緹娃」、「國王家族」、「八木茶飲」… 
 * @returns {{ address: string, context: string, urls: string[] }}
 */
export function extractVendorMeta(vendor) {
  if (!vendor) {
    return { address: "", context: "", urls: [] };
  }

  const v = normalize(vendor);
  const faq = FAQ_DATA;

  let matchedItem = null;

  // 找出第一個有包含該 vendor 關鍵字的 FAQ 項目
  for (const item of faq) {
    if (!item || !Array.isArray(item.q)) continue;

    const hit = item.q.some((q) => {
      const nq = normalize(q);
      if (!nq) return false;
      return nq.includes(v) || v.includes(nq);
    });

    if (hit) {
      matchedItem = item;
      break;
    }
  }

  if (!matchedItem) {
    return { address: "", context: "", urls: [] };
  }

  const answer = String(matchedItem.a ?? "");

  // 粗略從文字中抓出地址（📍 開頭那一行）
  let address = "";
  const addrMatch = answer.match(/📍\s*([^\n]+)/);
  if (addrMatch) {
    address = addrMatch[1].trim();
  }

  // 抓出所有網址，當作可能官方 / FB / 店家連結
  const urls = [];
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  let m;
  while ((m = urlRegex.exec(answer)) !== null) {
    urls.push(m[1]);
  }

  return {
    address,
    context: answer.trim(),
    urls
  };
}
