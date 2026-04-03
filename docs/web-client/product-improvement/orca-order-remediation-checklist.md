# ORCA繧ｪ繝ｼ繝繝ｼ譏ｯ豁｣ 菴懈･ｭ險育判譖ｸ

## 逶ｮ逧・

ORCA繧ｪ繝ｼ繝繝ｼ邉ｻ縺ｮ菫晏ｭ倥・蜀崎ｪｭ霎ｼ繝ｻ騾∽ｿ｡豁｣隕丞喧繝ｻmedicalmodv2 XML 繧呈悽逡ｪ驕狗畑蜑肴署縺ｧ譏ｯ豁｣縺励・*縲檎判髱｢縺ｧ菫晏ｭ倥〒縺阪ｋ蜀・ｮｹ縲阪→縲薫RCA縺ｸ騾√ｉ繧後ｋ蜀・ｮｹ縲阪′荳閾ｴ縺吶ｋ迥ｶ諷・*縺ｸ遘ｻ陦後☆繧九・

## 蝗ｺ螳壼燕謠・

- 蠕梧婿莠呈鋤諤ｧ縺ｯ閠・・縺励↑縺・・
- 譌ｧDB驕ｺ逕｣縺ｯ閠・・縺励↑縺・・
- build謌先棡迚ｩ縺ｯ辟｡隕悶＠縲√た繝ｼ繧ｹ繧ｳ繝ｼ繝峨□縺代ｒ蟇ｾ雎｡縺ｫ縺吶ｋ縲・
- 螟夜Κ諠・ｱ縺ｯ菴ｿ繧上★縲√％縺ｮ繝ｪ繝昴ず繝医Μ縺ｨ譌｢蟄倥Ξ繝薙Η繝ｼ邨先棡縺縺代ｒ譬ｹ諡縺ｫ縺吶ｋ縲・
- 騾√ｌ縺ｪ縺・､縺ｯ鮟吶▲縺ｦ關ｽ縺ｨ縺輔★縲・*菫晏ｭ伜燕縺ｾ縺溘・騾∽ｿ｡蜑阪〒蠢・★譏守､ｺ繝悶Ο繝・け**縺吶ｋ縲・
- UI/DTO 縺ｫ蟄伜惠縺吶ｋ螻樊ｧ縺ｯ縲・*ORCA 縺ｫ騾√ｋ / local-only 縺ｨ縺励※髢峨§繧・*縺ｮ縺ｩ縺｡繧峨°縺ｸ譏守､ｺ逧・↓蟇・○繧九・

## 螳御ｺ・擅莉ｶ

- [x] 蜃ｦ譁ｹ繧貞性繧蜈ｨ繧ｪ繝ｼ繝繝ｼ縺ｧ縲∽ｿ晏ｭ・source of truth 縺ｨ ORCA騾∽ｿ｡ source of truth 縺御ｸ閾ｴ縺励※縺・ｋ縲・
- [x] code-less row / mixed coded+uncoded row / manual bodyPart 縺ｪ縺ｩ縺ｮ **silent drop** 縺梧ｶ医∴縺ｦ縺・ｋ縲・
- [x] `testOrder / laboTest`縲～generalOrder / treatmentOrder`縲…harge class meta 縺ｮ canonical rule 縺悟・螻､縺ｧ荳雋ｫ縺励※縺・ｋ縲・
- [x] `unit` 繧貞性繧騾∽ｿ｡蟇ｾ雎｡螻樊ｧ縺・medicalmodv2 XML 縺ｾ縺ｧ蛻ｰ驕斐☆繧九°縲∵悴蟇ｾ蠢懊→縺励※ UI/validation 縺ｧ髢峨§繧峨ｌ縺ｦ縺・ｋ縲・
- [x] `bodyPart`縲～adminCode`縲〉ow role / subtype縲√さ繝｡繝ｳ繝・parameter 縺ｪ縺ｩ縺ｮ first-class 蛹悶′蠢・ｦ√↑邂・園縺瑚ｧ｣豸医＆繧後※縺・ｋ縲・
- [x] editor 蠢・域擅莉ｶ縺ｨ騾∽ｿ｡蜑榊ｿ・域擅莉ｶ縺御ｸ閾ｴ縺励＾RCA 縺ｸ騾√ｌ縺ｪ縺・・蜉帙′ UI 荳翫〒隱､隱阪＆繧後↑縺・・
- [x] web-client / server-modernized 縺ｮ蝗槫ｸｰ繝・せ繝医〒縲《ave 竊・fetch 竊・normalize 竊・XML 縺ｾ縺ｧ縺ｮ雋ｫ騾壹こ繝ｼ繧ｹ縺悟ｮ医ｉ繧後※縺・ｋ縲・

---

## 0. 豎ｺ螳壹Ο繧ｰ・域怙蛻昴↓蝓九ａ繧具ｼ・

> 螳溯｣・捩謇句燕縺ｫ縲√％縺ｮ谺・∈ canonical decision 繧定ｨ伜・縺吶ｋ縲よ悴豎ｺ螳壹・縺ｾ縺ｾ繧ｳ繝ｼ繝牙､画峩繧帝幕蟋九＠縺ｪ縺・・

- [x] `testOrder / laboTest` 縺ｮ canonical entity 繧呈ｱｺ螳壹＠縲√％縺ｮ譁・嶌縺ｸ霑ｽ險倥☆繧九・
  - canonical entity 縺ｯ `testOrder` 縺ｨ縺吶ｋ縲ＡlaboTest` 縺ｯ ingress 莠呈鋤 alias 縺ｨ縺励※縺ｮ縺ｿ蜿励￠縲’etch / input set / save / send / summary 縺ｧ縺ｯ `testOrder` 縺ｸ豁｣隕丞喧縺吶ｋ縲・
- [x] `generalOrder` 繧・`treatmentOrder` 縺ｮ alias 縺ｨ縺吶ｋ縺九∝挨讎ょｿｵ縺ｨ縺励※邯ｭ謖√☆繧九°繧呈ｱｺ螳壹＠縲√％縺ｮ譁・嶌縺ｸ霑ｽ險倥☆繧九・
  - `generalOrder` 縺ｯ `treatmentOrder` 縺ｮ ingress alias 縺ｨ縺励・00邉ｻ縺ｯ save / input set / send 縺ｮ canonical 繧・`treatmentOrder` 縺ｫ邨ｱ荳縺吶ｋ縲ＡotherOrder` 縺ｯ 800邉ｻ縺ｮ蛻･讎ょｿｵ縺ｨ縺励※邯ｭ謖√☆繧九・
- [x] charge 邉ｻ・・baseChargeOrder` / `instractionChargeOrder`・峨・ class meta 繧・**entity default 縺ｧ縺ｯ縺ｪ縺・first-class 菫晏ｭ伜､**縺ｨ縺励※謇ｱ縺・婿驥昴ｒ霑ｽ險倥☆繧九・
  - charge 邉ｻ縺ｯ `classCode / classCodeSystem / className` 繧・first-class 菫晏ｭ伜､縺ｨ縺励※謇ｱ縺・∵里蟄・bundle / input set 縺梧戟縺､ class 邊貞ｺｦ繧・edit-save 縺ｧ entity default 縺ｫ蜀崎ｨ育ｮ励＠縺ｪ縺・Ｆntity default 縺ｯ譁ｰ隕丈ｽ懈・譎ゅ・蛻晄悄蛟､縺ｫ縺ｮ縺ｿ菴ｿ縺・・
- [x] `bodyPart` 繧・first-class field 縺ｧ謖√▽遞ｮ蛻･縺ｨ縲・壼ｸｸ code row 縺ｨ縺励※縺ｮ縺ｿ謇ｱ縺・ｨｮ蛻･繧呈ｱｺ螳壹＠縺ｦ霑ｽ險倥☆繧九・
  - `bodyPart` 繧・first-class field 縺ｧ菫晄戟縺吶ｋ縺ｮ縺ｯ `radiologyOrder` 縺ｨ 400/800 邉ｻ縺ｮ body part 蟇ｾ蠢・bundle・・anonical `treatmentOrder` / `otherOrder`・峨→縺吶ｋ縲ゅ◎縺ｮ莉悶・ entity 縺ｧ縺ｯ body part 鬚ｨ繧ｳ繝ｼ繝峨ｒ蟆ら畑 field 縺ｫ譏・ｼ縺輔○縺壹・壼ｸｸ code row 縺ｨ縺励※謇ｱ縺・・
- [x] `unit` / `memo` / `admin` / `adminCode` / `bundleName` / `startDate` / `item.memo` 縺ｫ縺､縺・※縲・*騾∽ｿ｡蟇ｾ雎｡**縺・**local-only** 縺九ｒ遞ｮ蛻･縺斐→縺ｫ霑ｽ險倥☆繧九・
  - `unit`: ORCA 縺ｸ騾√ｋ coded row 縺ｮ first-class 騾∽ｿ｡蟇ｾ雎｡縺ｨ縺吶ｋ縲Ｎedicalmodv2 XML 縺ｾ縺ｧ蠢・★蛻ｰ驕斐＆縺帙ｋ縲・
  - `admin` / `adminCode`: `medOrder` 縺ｨ `injectionOrder` 縺ｮ騾∽ｿ｡蟇ｾ雎｡縺ｨ縺吶ｋ縲ゆｿ晏ｭ倥・fetch繝ｻ騾∽ｿ｡縺ｧ縺ｯ蛻･ field 縺ｨ縺励※菫晄戟縺励「sage / administration row 縺ｫ關ｽ縺ｨ縺苓ｾｼ繧縲ゅ◎縺ｮ莉・entity 縺ｧ縺ｯ local-only縲・
  - `bundleName`: 蜈ｨ entity 縺ｧ local-only縲６I 陦ｨ遉ｺ蜷阪→縺励※菫晄戟縺吶ｋ縺・ORCA XML 縺ｸ縺ｯ騾√ｉ縺ｪ縺・・
  - `startDate`: 蜈ｨ entity 縺ｧ local-only縲Ｃundle 蜊倅ｽ阪・邱ｨ髮・・蜀崎｡ｨ遉ｺ縺ｫ縺ｯ菫晄戟縺吶ｋ縺・ORCA XML 縺ｸ縺ｯ騾√ｉ縺ｪ縺・・
  - `memo`: free-form memo 縺ｯ local-only縲０RCA 縺ｸ騾√ｋ蠢・ｦ√′縺ゅｋ蜀・ｮｹ縺ｯ coded row / first-class field 縺ｫ讒矩蛹悶＠縲∵ｧ矩蛹悶〒縺阪↑縺・､縺ｯ騾∽ｿ｡蜑阪↓ block 縺吶ｋ縲・
  - `item.memo`: free-form comment 縺ｯ local-only縲Ｉidden meta 縺ｮ驕区成縺ｫ縺ｯ菴ｿ繧上★縲・∽ｿ｡蟇ｾ雎｡縺悟ｿ・ｦ√↑蝣ｴ蜷医・ first-class field 縺ｾ縺溘・ coded comment row 縺ｫ蛻・屬縺吶ｋ縲・
- [x] `genericFlg` 繧剃ｸ闊ｬ蜷咲嶌蠖薙→蠕檎匱蜩∝庄蜷ｦ縺ｫ蛻・屬縺吶ｋ譁ｹ驥昴ｒ霑ｽ險倥☆繧九・
  - 蜃ｦ譁ｹ繝ｻ豕ｨ蟆・・ drug meta 縺ｧ縺ｯ `genericFlg` 繧貞ｻ・ｭ｢縺励～isGeneralNamePrescription` 縺ｨ `genericChangeAllowed` 縺ｫ蛻・屬縺吶ｋ縲ょｾ檎匱蜩∝庄蜷ｦ縺縺代ｒ ORCA generic flag 縺ｸ蜿肴丐縺励∽ｸ闊ｬ蜷咲嶌蠖楢｡ｨ遉ｺ縺ｯ蛻･ field 縺ｨ縺励※ round-trip 縺吶ｋ縲・
- [x] `rpNumber` 繧・RP 隴伜挨蟄舌→縺励※荳諢丞喧縺吶ｋ譁ｹ驥昴ｒ霑ｽ險倥☆繧九・
  - `rpNumber` 縺ｯ stable 縺ｪ RP 隴伜挨蟄舌→縺励※菫晏ｭ倥＠縲～Medical_Class_Number` / 譌･謨ｰ繝ｻ蝗樊焚縺ｨ縺ｯ蛻・屬縺吶ｋ縲３P identity 縺ｯ `bundleNumber` 縺九ｉ蟆主・縺励↑縺・・

---

## 1. P0繝悶Ο繝・き繝ｼ譏ｯ豁｣

### 1-1. save/send source of truth 邨ｱ荳

- [x] 蜃ｦ譁ｹ縺ｮ菫晏ｭ倡ｵ瑚ｷｯ縺ｨ ORCA騾∽ｿ｡邨瑚ｷｯ繧剃ｸ譛ｬ蛹悶☆繧九・
  - 荳ｻ蟇ｾ雎｡: `web-client/src/features/charts/PrescriptionOrderEditorPanel.tsx`
  - 荳ｻ蟇ｾ雎｡: `web-client/src/features/charts/prescriptionOrderApi.ts`
  - 荳ｻ蟇ｾ雎｡: `web-client/src/features/charts/ChartsActionBar.tsx`
  - 荳ｻ蟇ｾ雎｡: `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaPrescriptionOrderResource.java`
  - 荳ｻ蟇ｾ雎｡: `server-modernized/src/main/java/open/dolphin/rest/orca/PrescriptionOrderRepository.java`
- [x] 蜃ｦ譁ｹ菫晏ｭ伜ｾ後↓ UI 陦ｨ遉ｺ繝ｻ蜀崎ｪｭ霎ｼ繝ｻ騾∽ｿ｡ payload 縺悟酔荳蜀・ｮｹ縺ｫ縺ｪ繧・E2E 繝・せ繝医ｒ霑ｽ蜉縺吶ｋ縲・

### 1-2. silent drop 遖∵ｭ｢

- [x] non-med 蜈ｨ遞ｮ蛻･縺ｧ code-less row 縺碁∽ｿ｡譎ゅ↓鮟吶▲縺ｦ關ｽ縺｡縺ｪ縺・ｈ縺・∽ｿ晏ｭ伜燕縺ｾ縺溘・騾∽ｿ｡蜑阪〒譏守､ｺ繝悶Ο繝・け縺吶ｋ縲・
- [x] mixed coded / uncoded row 縺後≠繧・bundle 繧帝∽ｿ｡蜑阪↓譏守､ｺ繧ｨ繝ｩ繝ｼ縺ｫ縺吶ｋ縲・
- [x] coded comment 縺縺代′騾√ｉ繧後※ main row 縺瑚誠縺｡繧九こ繝ｼ繧ｹ繧堤ｦ∵ｭ｢縺吶ｋ縲・
- [x] `ChartsActionBar` 縺ｮ `filter(Boolean)` 萓晏ｭ倥ｒ繧・ａ縲｜undle 蜊倅ｽ阪・ drop 逅・罰繧偵Θ繝ｼ繧ｶ繝ｼ縺ｫ蜿ｯ隕門喧縺吶ｋ縲・
  - 荳ｻ蟇ｾ雎｡: `web-client/src/features/charts/OrderBundleEditPanel.tsx`
  - 荳ｻ蟇ｾ雎｡: `web-client/src/features/charts/orderRpNormalization.ts`
  - 荳ｻ蟇ｾ雎｡: `web-client/src/features/charts/orderRpRequirements.ts`
  - 荳ｻ蟇ｾ雎｡: `web-client/src/features/charts/ChartsActionBar.tsx`

### 1-3. entity / class canonical 蛹・

- [x] `testOrder / laboTest` 縺ｮ canonical rule 繧・save / fetch / input set / summary / projection / send 縺ｧ邨ｱ荳縺吶ｋ縲・
- [x] `generalOrder / treatmentOrder` 縺ｮ canonical rule 繧・save / input set / send 縺ｧ邨ｱ荳縺吶ｋ縲・
- [x] `baseChargeOrder / instractionChargeOrder` 縺ｮ class meta 繧・form state 縺ｧ菫晄戟縺励∫ｷｨ髮・ｿ晏ｭ倥〒 entity default 縺ｫ貎ｰ縺輔↑縺・・- [x] `classCode 600` 縺ｮ subtype 縺・send grouping 縺ｧ莠碁㍾蛹悶＠縺ｪ縺・ｈ縺・ｿｮ豁｣縺吶ｋ縲・- [ ] `classCode 400` 縺ｮ input set / UI / send meaning 縺御ｸ蛾㍾蛹悶＠縺ｪ縺・ｈ縺・ｿｮ豁｣縺吶ｋ縲・
  - 荳ｻ蟇ｾ雎｡: `web-client/src/features/charts/orderCategoryRegistry.ts`
  - 荳ｻ蟇ｾ雎｡: `web-client/src/features/charts/OrderDockPanel.tsx`
  - 荳ｻ蟇ｾ雎｡: `web-client/src/features/charts/RightUtilityDrawer.tsx`
  - 荳ｻ蟇ｾ雎｡: `web-client/src/features/charts/SoapNotePanel.tsx`
  - 荳ｻ蟇ｾ雎｡: `web-client/src/features/charts/OrderBundleEditPanel.tsx`
  - 荳ｻ蟇ｾ雎｡: `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaOrderBundleRequestSupport.java`
  - 荳ｻ蟇ｾ雎｡: `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaOrderBundleFetchSupport.java`
  - 荳ｻ蟇ｾ雎｡: `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaOrderInputSetMetadataSupport.java`

### 1-4. XML 螂醍ｴ・・譛蟆乗弍豁｣

- [x] `unit` 繧・medicalmodv2 XML 縺ｸ蜃ｺ蜉帙☆繧九°縲∵悴蟇ｾ蠢懊→縺励※ UI/validation 縺ｧ髢峨§繧九・
- [x] `Medical_Class` / `Medical_Class_Name` / `Medical_Class_Number` 縺縺代〒縺ｯ諢丞袖荳崎ｶｳ縺ｪ遞ｮ蛻･縺ｫ縺､縺・※縲∵怙菴朱剞蠢・ｦ√↑騾∽ｿ｡陦ｨ迴ｾ繧呈紛逅・☆繧九・
- [x] 螳・XML 繧堤峩謗･讀懈渊縺吶ｋ server test 繧定ｿｽ蜉縺吶ｋ縲・
  - 荳ｻ蟇ｾ雎｡: `server-modernized/src/main/java/open/dolphin/rest/orca/OrcaChartSupportSupport.java`
  - 荳ｻ蟇ｾ雎｡: `server-modernized/src/test/java/open/dolphin/rest/orca/OrcaChartSupportSupportTest.java`

---

## 2. 讓ｪ譁ｭ繝・・繧ｿ繝｢繝・Ν譏ｯ豁｣

### 2-1. first-class field 蛹・

- [x] `adminCode / adminCodeSystem` 繧貞ｿ・ｦ∫ｨｮ蛻･縺ｧ first-class field 縺ｨ縺励※菫晏ｭ倥・蜿門ｾ励・騾∽ｿ｡縺ｧ縺阪ｋ繧医≧縺ｫ縺吶ｋ縲・
- [x] `bodyPart` 繧貞ｿ・ｦ∫ｨｮ蛻･縺ｧ first-class field 縺ｨ縺励（tems 縺ｨ縺ｮ莠碁㍾陦ｨ迴ｾ繧偵ｄ繧√ｋ縲・
- [x] row role / subtype・域焔謚繝ｻ譚先侭繝ｻ阮ｬ蜑､繝ｻ讀應ｽ薙・蝓ｹ鬢翫・諢溷女諤ｧ繝ｻ譛ｬ菴薙・騾蠖ｱ繝ｻ繧ｳ繝｡繝ｳ繝育ｭ会ｼ峨ｒ蠢・ｦ∫ｨｮ蛻･縺ｧ菫晄戟縺ｧ縺阪ｋ繧医≧縺ｫ縺吶ｋ縲・
- [x] 繧ｳ繝｡繝ｳ繝・parameter・磯∈謚槫ｼ上さ繝｡繝ｳ繝医・ itemNumber / branch 縺ｪ縺ｩ・峨ｒ first-class 縺ｫ縺吶ｋ縺九∵悴蟇ｾ蠢懊→縺励※蜈･蜉帑ｸ榊庄縺ｫ縺吶ｋ縲・
- [x] `setCode` provenance 繧剃ｿ晄戟縺吶ｋ縺九∽ｻ墓ｧ倥→縺励※ expansion-only 縺ｫ蝗ｺ螳壹＠縺ｦ UI 縺ｨ逶｣譟ｻ邨瑚ｷｯ繧呈純縺医ｋ縲・

### 2-2. private memo codec 隗｣菴・

- [x] 蜃ｦ譁ｹ縺ｮ `__rx_*` / `__orca_meta__` 萓晏ｭ倥ｒ邵ｮ蟆上＠縲’irst-class DTO 縺ｸ遘ｻ縺吶・
- [x] item memo 繧・generic meta 蜈ｼ逕ｨ縺ｫ縺励※縺・ｋ邂・園繧呈紛逅・＠縲∬・逕ｱ繧ｳ繝｡繝ｳ繝医→ hidden meta 繧貞・髮｢縺吶ｋ縲・
- [x] hidden field・・adminMemo`縲”idden `bodyPart`縲～謇区橿譁吶↑縺輿 sentinel 縺ｪ縺ｩ・峨・縺ｾ縺ｾ諢丞袖繧呈戟縺､螳溯｣・ｒ縺ｪ縺上☆縲・

### 2-3. local-only 縺ｨ騾∽ｿ｡蟇ｾ雎｡縺ｮ謨ｴ逅・

- [x] local-only 縺ｫ谿九☆螻樊ｧ繧呈・譁・喧縺励ゞI 陦ｨ遉ｺ繧ゅ碁劼蜀・Ο繝ｼ繧ｫ繝ｫ諠・ｱ縲阪→蛻・°繧九ｈ縺・↓縺吶ｋ縲・
- [x] ORCA 縺ｸ騾√ｋ螻樊ｧ縺ｯ DTO / save / fetch / normalize / XML 縺ｮ蜈ｨ螻､縺ｧ關ｽ縺｡縺ｪ縺・ｈ縺・↓縺吶ｋ縲・
- [x] local-only 縺ｫ縺吶ｋ螻樊ｧ縺ｯ騾∽ｿ｡蜑・validation 縺九ｉ髯､螟悶＠縲∬ｪ､隗｣繧呈魚縺・placeholder / label 繧剃ｿｮ豁｣縺吶ｋ縲・

---

## 3. UI / validation 譏ｯ豁｣

### 3-1. 蜈ｱ騾・editor

- [x] `BundleFormState` 縺ｫ non-med 縺ｮ class meta 繧剃ｿ晄戟縺吶ｋ縲・
- [x] `validateBundleForm` 繧偵悟・蜉帙〒縺阪ｋ縺九阪〒縺ｯ縺ｪ縺上薫RCA 縺ｸ騾√ｌ繧九°縲阪〒隕狗峩縺吶・
- [x] `supportsBodyPartSearch`縲～supportsInjectionNoProcedure`縲～supportsCommentCodes` 縺ｮ諢丞袖縺碁∽ｿ｡螂醍ｴ・→荳閾ｴ縺吶ｋ繧医≧隕狗峩縺吶・
- [x] input set 蜿肴丐譎ゅ↓ hidden field 繧・entity mismatch 縺瑚ｵｷ縺阪↑縺・ｈ縺・ｿｮ豁｣縺吶ｋ縲・

### 3-2. 騾∽ｿ｡蜑・validation

- [x] `medOrder / injectionOrder` 縺縺代〒縺ｪ縺上］on-med 蜈ｨ遞ｮ蛻･縺ｮ騾∽ｿ｡蜑阪ぎ繝ｼ繝峨ｒ謨ｴ蛯吶☆繧九・
- [x] unsupported field 繧貞性繧 bundle 縺ｯ縲｜undle 蜊倅ｽ阪・譏守､ｺ繧ｨ繝ｩ繝ｼ縺ｫ縺吶ｋ縲・
- [x] `002...` bodyPart code 繧・comment code 繧貞性繧陦後′騾∽ｿ｡蜑阪さ繝ｼ繝画､懈渊縺ｧ隱､蛻､螳壹＆繧後↑縺・ｈ縺・ｦ狗峩縺吶・
- [x] `40/40` 蛻ｶ髯舌ｄ `Medical_Class` 邊礼ｲ貞ｺｦ蛹悶↓繧医ｋ grouping 繝ｪ繧ｹ繧ｯ繧呈､懃衍縺吶ｋ繝・せ繝医∪縺溘・ guard 繧定ｿｽ蜉縺吶ｋ縲・

---

## 4. 遞ｮ蛻･蛻･菴懈･ｭ

### 4-1. 蜃ｦ譁ｹ (`medOrder`)

- [x] 蜃ｦ譁ｹ菫晏ｭ倥→ ORCA騾∽ｿ｡縺ｮ source of truth 繧剃ｸ譛ｬ蛹悶☆繧九・
- [x] `genericFlg` 繧偵御ｸ闊ｬ蜷咲嶌蠖薙阪→縲悟ｾ檎匱蜩∝庄蜷ｦ縲阪↓蛻・屬縺吶ｋ縲・
- [x] `rpNumber` 繧剃ｸ諢上↑ RP 隴伜挨蟄舌↓縺吶ｋ縲・
- [x] `221 / 222 / 231 / 232` 縺ｮ input set 蜿冶ｾｼ縺ｧ classCode / usageCode / comments / location / category 縺悟｣翫ｌ縺ｪ縺・ｈ縺・↓縺吶ｋ縲・
- [x] `location:'out'` / `category:'regular'` 縺ｮ蝗ｺ螳壼､繧呈彫蜴ｻ縺吶ｋ縲・
  - recommendation / input set 蜿冶ｾｼ譎ゅ・ `Medical_Class` 繧定ｵｷ轤ｹ縺ｫ RP 縺ｮ `location` / `category` 繧貞・讒区・縺励”ard-coded default 繧剃ｽｿ繧上↑縺・・
- [x] `remark`縲～doctorComment`縲～drugComment`縲～claimComments.note`縲～refillCount`縲～refillPattern`縲～patientRequest`縲～lower*`縲∬・逕ｱ蜈･蜉・`usage` 縺ｮ謇ｱ縺・ｒ豎ｺ繧√・√ｋ縺矩哩縺倥ｋ縺九ｒ邨ｱ荳縺吶ｋ縲・
- [x] code 縺ｪ縺苓ｫ区ｱゅさ繝｡繝ｳ繝医ｒ騾√ｋ縺ｮ縺矩哩縺倥ｋ縺ｮ縺九ｒ譏取枚蛹悶☆繧九・
- [x] 1 RP 隍・焚阮ｬ蜑､繝ｻ隍・焚 RP繝ｻ蜈ｨ classCode 縺ｮ save/fetch/send/XML 繝・せ繝医ｒ霑ｽ蜉縺吶ｋ縲・

### 4-2. 豕ｨ蟆・(`injectionOrder`)

- [x] `admin` 縺ｨ `adminCode` 繧貞・髮｢縺吶ｋ縲・
- [x] route / timing / frequency / speed / dosePerDay 縺ｮ謇ｱ縺・ｒ first-class 縺ｫ縺吶ｋ縺・local-only 縺ｨ縺励※髢峨§繧九・
  - 注射送信では `admin/adminCode`・回数・coded row・`rowRole` を使用し、`route/timing/frequency/dosePerDay` は用法候補の参照表示、`speed` は `adminMemo`、行ごとの注射コメントは local-only として固定した。
- [x] `supportsInjectionNoProcedure=true` 縺ｮ sentinel 螳溯｣・ｒ繧・ａ縲∵э蜻ｳ繧帝√ｋ縺・UI 縺九ｉ螟悶☆縺九ｒ豎ｺ繧√ｋ縲・
- [x] 轤ｹ貊ｴ繧ｻ繝・ヨ繝ｻ謇区橿+阮ｬ蜑､繝ｻ阮ｬ蜑､縺ｮ縺ｿ縺ｮ 3 繝代ち繝ｼ繝ｳ縺ｧ role 繧剃ｿ晄戟縺ｧ縺阪ｋ繧医≧縺ｫ縺吶ｋ縲・
  - `rowRole=main/material/comment` を save/fetch/normalize/send で保持し、薬剤のみ・手技+薬剤・点滴セットの 3 パターンを actual XML まで順序固定で検証した。
- [x] 豕ｨ蟆・・閾ｪ逕ｱ繧ｳ繝｡繝ｳ繝医→ hidden meta 縺瑚｡晉ｪ√＠縺ｪ縺・ｈ縺・紛逅・☆繧九・
  - 注射コメントは `userComment` first-class へ移し、保存前に空白のみ値を除去することで hidden meta への逆戻りと silent carry-over を止めた。
- [x] 豕ｨ蟆・・ generic flag / comment / unit / adminCode 繧貞性繧 round-trip 縺ｨ XML 繝・せ繝医ｒ霑ｽ蜉縺吶ｋ縲・

### 4-3. 蝓ｺ譛ｬ險ｺ逋よ侭 / 謖・ｰ取侭 (`baseChargeOrder` / `instractionChargeOrder`)

- [x] 邱ｨ髮・ヵ繧ｩ繝ｼ繝縺ｧ explicit classCode / className / classCodeSystem 繧剃ｿ晄戟縺吶ｋ縲・- [x] ORCA蜈･蜉帙そ繝・ヨ繧・里蟄・bundle 縺ｮ class 邊貞ｺｦ繧・edit-save 縺ｧ貎ｰ縺輔↑縺・・- [x] `adminMemo` 縺ｮ hidden state 繧偵↑縺上＠縲∝ｿ・ｦ√↑繧・UI 蜿ｯ隕門喧縺吶ｋ縲・- [ ] 84邉ｻ繧ｳ繝｡繝ｳ繝・/ 驕ｸ謚槫ｼ上さ繝｡繝ｳ繝・parameter 繧・first-class 縺ｫ縺吶ｋ縺句・蜉帑ｸ榊庄縺ｫ縺吶ｋ縲・
- [x] `unit`縲∫ｮ怜ｮ壽欠遉ｺ縲∫ｮ怜ｮ壹Γ繝｢縲√さ繝｡繝ｳ繝・parameter 縺ｮ騾∽ｿ｡譁ｹ驥昴ｒ蝗ｺ螳壹☆繧九・
- [x] basic / instruction charge 縺ｮ save/send/XML 繝・せ繝医ｒ霑ｽ蜉縺吶ｋ縲・
### 4-4. 蜃ｦ鄂ｮ / 荳闊ｬ / 縺昴・莉・(`treatmentOrder` / `generalOrder` / `otherOrder`)

- [x] `generalOrder` 縺ｮ諢丞袖繧貞崋螳壹＠縲～treatmentOrder` 縺ｨ縺ｮ relation 繧剃ｸ譛ｬ蛹悶☆繧九・
- [x] row role・域焔謚 / 譚先侭 / 菴ｵ逕ｨ阮ｬ蜑､ / 繧ｳ繝｡繝ｳ繝茨ｼ峨ｒ菫晄戟縺吶ｋ縲・
- [x] `bodyPart` 縺ｮ莠碁㍾陦ｨ迴ｾ繧偵ｄ繧√ｋ縲・
- [x] `otherOrder` 繧偵悟・鄂ｮ縺ｮ騾・￡驕薙阪↓縺励↑縺・ｈ縺・∬ｨｱ螳ｹ蜈･蜉帙ｒ隕狗峩縺吶・
- [x] `setCode`縲～bundleName`縲～admin`縲～memo` 縺ｮ謇ｱ縺・ｒ騾∽ｿ｡螂醍ｴ・↓蜷医ｏ縺帙※謨ｴ逅・☆繧九・
- [x] 400 / 800 邉ｻ縺ｮ code-less row縲…omment-only縲〈uantity-only 繧ｱ繝ｼ繧ｹ繧呈・遉ｺ block 縺ｫ縺吶ｋ縲・
- [x] 400 / 800 邉ｻ縺ｮ save/fetch/send/XML 繝・せ繝医ｒ霑ｽ蜉縺吶ｋ縲・

### 4-5. 謾ｾ蟆・ｷ・(`radiologyOrder`)

- [x] radiology 700 譚溘・謌千ｫ区擅莉ｶ・域悽菴薙さ繝ｼ繝峨・Κ菴阪∵攝譁・騾蠖ｱ role・峨ｒ螳夂ｾｩ縺・validation 縺ｸ蜿肴丐縺吶ｋ縲・  - 騾比ｸｭ蟇ｾ蠢・ `OrcaOrderBundleMutationExecutionSupport` 縺ｧ `radiologyOrder` 縺ｮ `bodyPart` 谺關ｽ繧・400 縺ｧ諡貞凄縺吶ｋ server-side validation 繧定ｿｽ蜉縺励◆縲よ攝譁・騾蠖ｱ role 縺ｨ row order 縺ｮ遒ｺ螳壹・譛ｪ螳後・- [x] `bodyPart` 縺ｮ manual / master selected 荳｡邨瑚ｷｯ繧貞腰荳繝｢繝・Ν縺ｫ邨ｱ荳縺吶ｋ縲・
- [x] bodyPart code 縺ｨ騾壼ｸｸ row 縺ｮ遶ｶ蜷医ｒ隗｣豸医☆繧九・
- [x] row order・・odyPart / 譛ｬ菴・/ 騾蠖ｱ / 譚先侭 / comment・峨ｒ round-trip 縺ｧ菫晄戟縺吶ｋ縲・
- [x] `startsWith('7')` 譚先侭蛻､螳壹′ radiology item 繧定ｪ､蛻・｡槭＠縺ｪ縺・ｈ縺・ｿｮ豁｣縺吶ｋ縲・  - `OrderBundleEditPanel.toFormState()` 縺ｮ蛻・ｧ｣蜃ｦ逅・ｒ entity-aware 縺ｫ縺励～radiologyOrder` 縺ｧ縺ｯ `7...` 繧・prefix 縺縺代〒譚先侭陦後∈騾・′縺輔↑縺・ｈ縺・ｿｮ豁｣縺励◆縲ＡorderBundlePrescription.test.ts` 縺ｫ radiology round-trip 蝗槫ｸｰ繧定ｿｽ蜉縺励｜odyPart 縺ｨ譛ｬ菴楢｡後′蜿ｯ隕也憾諷九・縺ｾ縺ｾ菫晄戟縺輔ｌ繧九％縺ｨ繧貞崋螳壹＠縺溘・- [x] radiology save/fetch/send/XML 繝・せ繝医ｒ霑ｽ蜉縺吶ｋ縲・

### 4-6. 讀應ｽ・/ 逕溽炊 / 邏ｰ闖・(`testOrder` / `physiologyOrder` / `bacteriaOrder`)

- [x] `testOrder / laboTest` 縺ｮ canonical 蛹悶ｒ螳御ｺ・☆繧九・
- [x] class 600 縺ｮ input set 縺・canonical entity 縺ｫ謨ｴ蜷医☆繧九ｈ縺・ｿｮ豁｣縺吶ｋ縲・
- [x] 讀懈渊謖・､ｺ / 謗｡蜿匁擅莉ｶ / 閾ｳ諤･ / 蛯呵・/ specimen / culture / sensitivity / physiology subtype 縺ｮ讒矩蛹匁婿驥昴ｒ豎ｺ繧√ｋ縲・
- [x] 逕溽炊讀懈渊 UI 繧・generic 讀應ｽ・UI 豬∫畑縺九ｉ蠢・ｦ∫ｯ・峇縺ｧ蛻・屬縺吶ｋ縲・
- [x] bacteriaOrder 縺ｮ蠢・磯・岼縺ｨ subtype 繧・first-class 縺ｫ縺吶ｋ縲・
- [x] hidden bodyPart / hidden adminMemo 繧偵↑縺上☆縲・
- [x] class 600 縺ｮ subtype 縺・send grouping 縺ｧ蛻･鄒､荵ｱ遶九＠縺ｪ縺・ｈ縺・紛逅・☆繧九・
- [x] 600 邉ｻ save/fetch/input set/send/XML 繝・せ繝医ｒ霑ｽ蜉縺吶ｋ縲・

---

## 5. 繧ｵ繝ｼ繝仙・菫晏ｭ倥・蜈･蜉帙そ繝・ヨ繝ｻXML 譏ｯ豁｣

### 5-1. 菫晏ｭ・/ fetch

- [x] `OrcaOrderBundleMutationSupport` / `FetchSupport` 縺ｧ first-class 蛹悶＠縺溷ｱ樊ｧ繧・lossless 縺ｫ謇ｱ縺・・
- [x] raw entity strict equality 萓晏ｭ倥ｒ繧・ａ縲…anonical entity rule 縺ｫ蟇・○繧九・
- [x] `entity / classCode / item鄒､` 縺ｮ荳肴紛蜷医ｒ server 蛛ｴ縺ｧ繧ょｼｾ縺上・  - 騾比ｸｭ蟇ｾ蠢・ server 蛛ｴ縺ｧ `comment-only/bodyPart-only` 縺ｮ non-med bundle 繧・`items do not contain a sendable main row` 縺ｨ縺励※ reject 縺吶ｋ fail-closed 繧定ｿｽ蜉縺励◆縲Ｆntity 縺斐→縺ｮ row role / subtype 縺ｾ縺ｧ隕九◆謨ｴ蜷医メ繧ｧ繝・け縺ｯ譛ｪ螳後・
### 5-2. input set / recommendation

- [x] class 400 / 600 / 700 / 800 縺ｮ input set entity 隗｣豎ｺ繧・canonical rule 縺ｫ蜷医ｏ縺帙※譏ｯ豁｣縺吶ｋ縲・
- [x] input set detail 縺九ｉ關ｽ縺ｨ縺励※縺ｯ縺・￠縺ｪ縺・class meta / memo / comment / provenance 繧定誠縺ｨ縺輔↑縺・・
- [x] recommendation/template 縺梧戟縺､ row role / bodyPart / materialItems 縺・front 縺ｧ貎ｰ繧後↑縺・ｈ縺・･醍ｴ・ｒ謠・∴繧九・

### 5-3. XML builder

- [x] `OrcaChartSupportSupport` 縺ｫ蠢・ｦ√↑螻樊ｧ繧定ｿｽ蜉縺励～unit` 繧偵・縺倥ａ silent loss 繧偵↑縺上☆縲・
- [x] XML 縺ｫ蜃ｺ縺輔↑縺・ｱ樊ｧ縺ｯ upstream validation/UI 縺ｧ髢峨§繧九・
- [x] actual XML snapshot / assertion test 繧堤ｨｮ蛻･縺斐→縺ｫ霑ｽ蜉縺吶ｋ縲・

---

## 6. 繝・せ繝郁｣懷ｼｷ

### 6-1. web-client

- [x] entity canonicalization 繝・せ繝茨ｼ・testOrder/laboTest`, `generalOrder/treatmentOrder`・・
- [x] save payload 繝・せ繝茨ｼ・lass meta / bodyPart / adminCode / setCode・・
- [x] send preflight 繝・せ繝茨ｼ・ixed coded/uncoded, unsupported field, bodyPart code, comment parameter・・
- [x] ORCA input set apply 繝・せ繝茨ｼ・00/600/700/800 縺ｨ蜃ｦ譁ｹ・・- [x] Rx / injection / radiology / 600邉ｻ / charge 縺ｮ happy path send 繝・せ繝・- [x] builder mock 縺ｫ萓晏ｭ倥＠縺ｪ縺・ｵｱ蜷亥ｯ・ｊ繝・せ繝医ｒ霑ｽ蜉縺吶ｋ縲・
### 6-2. server-modernized

- [x] request validation 繝・せ繝茨ｼ・anonical entity, class/item consistency・・
- [x] mutation/fetch round-trip 繝・せ繝茨ｼ・irst-class fields, role, bodyPart, adminCode・・
- [x] input set metadata/detail 繝・せ繝茨ｼ・00/600 canonical, Rx semantics・・
- [x] actual XML 繝・せ繝茨ｼ・nit, class, rows, comments, local-only rejection・・
- 進捗メモ (2026-04-03): `OrcaOrderBundleResourceTest` で bacteria subtype 必須判定と treatmentOrder bodyPart 優先/legacy fallback 契約を再固定し、`OrcaChartSupportSupportTest` / `OrcaOrderBundleRecommendationSupportTest` と合わせて server 回帰を再実行して green を確認した。
- [x] ・俯ｰｩ import / merge 繝・せ繝茨ｼ・nique `rpNumber`, usageCode, comments・・

### 6-3. 蝗槫ｸｰ繝ｻQA

- [x] `save 竊・fetch 竊・normalize 竊・XML` 繧帝壹☆ smoke suite 繧堤畑諢上☆繧九・
- [x] 莉｣陦ｨ繧ｱ繝ｼ繧ｹ繧呈怙菴・1 譛ｬ縺壹▽霑ｽ蜉縺吶ｋ縲・
  - [x] 蜃ｦ譁ｹ: 1 RP 2阮ｬ蜑､ + 繧ｳ繝｡繝ｳ繝・+ 荳闊ｬ蜷・蠕檎匱蜩∝庄蜷ｦ
  - [x] 豕ｨ蟆・ 謇区橿+阮ｬ蜑､ + admin/adminCode + 蝗樊焚
  - [x] 蝓ｺ譛ｬ/謖・ｰ取侭: 髱・default class 縺ｮ蜀咲ｷｨ髮・ｿ晏ｭ・  - [x] 荳闊ｬ/蜃ｦ鄂ｮ/縺昴・莉・ mixed row 繧貞性繧 bundle
  - [x] 謾ｾ蟆・ｷ・ bodyPart + 譛ｬ菴・+ 譚先侭/騾蠖ｱ
  - [x] 讀應ｽ・逕溽炊/邏ｰ闖・ canonical entity + subtype + input set

---

## 7. 螳御ｺ・凾縺ｮ莉穂ｸ翫￡

- [x] 縺薙・險育判譖ｸ縺ｮ蜈ｨ繝√ぉ繝・け繧呈峩譁ｰ縺吶ｋ縲・
- [x] 譛邨ら噪縺ｫ local-only 縺ｨ騾∽ｿ｡蟇ｾ雎｡縺ｮ荳隕ｧ繧呈枚譖ｸ蛹悶☆繧九・
- [x] 螟画峩繝輔ぃ繧､繝ｫ荳隕ｧ縺ｨ縲∵悴隗｣豎ｺ繝ｪ繧ｹ繧ｯ荳隕ｧ繧・`notes/` 縺ｫ谿九☆縲・
- [x] 螳溯｡後＠縺・test 繧ｳ繝槭Φ繝峨→邨先棡繧定ｨ倬鹸縺吶ｋ縲・
- [x] 霑ｽ蜉縺励◆ canonical rule 繧・README/notes 縺ｮ驕ｩ蛻・↑蝣ｴ謇縺ｸ谿九☆縲・

---

## 謗ｨ螂ｨ螳溯｡碁・

1. 豎ｺ螳壹Ο繧ｰ繧貞沂繧√ｋ
2. P0繝悶Ο繝・き繝ｼ・・ave/send SoT縲《ilent drop縲…anonical縲々ML unit・・
3. first-class field 蛹・
4. UI / validation 譏ｯ豁｣
5. 繧ｵ繝ｼ繝蝉ｿ晏ｭ倥・input set繝ｻXML builder 譏ｯ豁｣
6. 遞ｮ蛻･蛻･縺ｮ谿玖ｪｲ鬘・
7. 繝・せ繝郁｣懷ｼｷ縺ｨ譛邨よ枚譖ｸ譖ｴ譁ｰ
