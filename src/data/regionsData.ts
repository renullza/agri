import eastAzSatelliteImg from '../assets/images/satellite_east_azerbaijan_1791362534077.jpg';
import westIranSatelliteImg from '../assets/images/satellite_west_iran_1791362545190.jpg';

export interface ParcelZone {
  id: string;
  name: string;
  code: string;
  areaHa: number;
  crop: string;
  growthStage: string;
  polygon: [number, number][]; // Normalized 0-100 coordinates on canvas
  center: [number, number];
  // Sentinel-2 Surface Reflectance (BOA - Bottom of Atmosphere, 0.0 to 1.0)
  bands: {
    B2_Blue: number;      // 490 nm
    B3_Green: number;     // 560 nm
    B4_Red: number;       // 665 nm
    B5_RedEdge1: number;  // 705 nm
    B8_NIR: number;       // 842 nm
    B8A_NarrowNIR: number;// 865 nm
    B11_SWIR1: number;    // 1610 nm
    B12_SWIR2: number;    // 2190 nm
  };
  // Sentinel-1 SAR Backscatter (dB)
  sar: {
    vvDb: number;
    vhDb: number;
  };
  // Calibrated Soil Properties (0-30 cm depth via CNN-Spectral Inversion)
  soil: {
    organicCarbonPct: number; // % SOC
    ph: number;
    ecDsM: number; // Electrical Conductivity (Salinity) dS/m
    nitrogenMgKg: number; // Available N
    phosphorusMgKg: number; // Olsen P
    potassiumMgKg: number; // Exchangeable K
    zincMgKg: number; // DTPA Zn
    volumetricMoisturePct: number; // % VWC
    fieldCapacityPct: number; // % FC
    wiltingPointPct: number; // % PWP
    texture: string;
  };
  dlDiagnosis: {
    modelName: string;
    confidencePct: number;
    status: 'nominal' | 'warning' | 'critical';
    statusLabel: string;
    primaryFinding: string;
    actionSummary: string;
  };
}

export interface RegionDataset {
  id: string;
  name: string;
  province: string;
  sentinelTile: string;
  acquisitionDate: string;
  passDirection: 'Descending' | 'Ascending';
  cloudCoverPct: number;
  lat: number;
  lon: number;
  utmZone: string;
  elevationM: number;
  imageAsset: string;
  climateSummary: string;
  dominantCrops: string[];
  defaultCropId: string;
  parcels: ParcelZone[];
  timeSeriesNDVI: { date: string; ndvi: number; ndmi: number; regionalAvg: number }[];
}

export interface CropParameter {
  id: string;
  name: string;
  scientificName: string;
  kcMid: number; // FAO-56 Crop Coefficient
  rootDepthCm: number;
  depletionFractionP: number; // Allowable depletion fraction before stress
  defaultTargetYieldTonHa: number;
  minYieldTonHa: number;
  maxYieldTonHa: number;
  // Base nutrient requirement per ton of yield (kg/ton)
  nPerTon: number;
  p2o5PerTon: number;
  k2oPerTon: number;
}

export const CROP_PARAMETERS: CropParameter[] = [
  {
    id: 'wheat',
    name: 'گندم آبی (ارقام سردسیری پیشگام / میهن)',
    scientificName: 'Triticum aestivum',
    kcMid: 1.15,
    rootDepthCm: 90,
    depletionFractionP: 0.55,
    defaultTargetYieldTonHa: 6.5,
    minYieldTonHa: 3.0,
    maxYieldTonHa: 10.0,
    nPerTon: 28,
    p2o5PerTon: 12,
    k2oPerTon: 20,
  },
  {
    id: 'potato',
    name: 'سیب‌زمینی (سراب و همدان - رقم آگریا)',
    scientificName: 'Solanum tuberosum',
    kcMid: 1.15,
    rootDepthCm: 60,
    depletionFractionP: 0.35,
    defaultTargetYieldTonHa: 42.0,
    minYieldTonHa: 20.0,
    maxYieldTonHa: 65.0,
    nPerTon: 4.5,
    p2o5PerTon: 2.2,
    k2oPerTon: 6.0,
  },
  {
    id: 'apple',
    name: 'باغات سیب (مراغه و ارومیه - رد و گلدن)',
    scientificName: 'Malus domestica',
    kcMid: 0.95,
    rootDepthCm: 120,
    depletionFractionP: 0.50,
    defaultTargetYieldTonHa: 35.0,
    minYieldTonHa: 15.0,
    maxYieldTonHa: 60.0,
    nPerTon: 3.8,
    p2o5PerTon: 1.8,
    k2oPerTon: 4.8,
  },
  {
    id: 'sugarbeet',
    name: 'چغندرقند (میاندوآب و نقده)',
    scientificName: 'Beta vulgaris',
    kcMid: 1.20,
    rootDepthCm: 100,
    depletionFractionP: 0.50,
    defaultTargetYieldTonHa: 55.0,
    minYieldTonHa: 30.0,
    maxYieldTonHa: 85.0,
    nPerTon: 4.0,
    p2o5PerTon: 1.9,
    k2oPerTon: 5.5,
  },
  {
    id: 'barley',
    name: 'جو آبی و دیم تکمیلی (تبریز و هشترود)',
    scientificName: 'Hordeum vulgare',
    kcMid: 1.05,
    rootDepthCm: 85,
    depletionFractionP: 0.55,
    defaultTargetYieldTonHa: 5.2,
    minYieldTonHa: 2.5,
    maxYieldTonHa: 8.5,
    nPerTon: 24,
    p2o5PerTon: 10,
    k2oPerTon: 18,
  },
  {
    id: 'canola',
    name: 'کلزا پاییزه (کرمانشاه و ماهیدشت)',
    scientificName: 'Brassica napus',
    kcMid: 1.10,
    rootDepthCm: 95,
    depletionFractionP: 0.45,
    defaultTargetYieldTonHa: 3.8,
    minYieldTonHa: 2.0,
    maxYieldTonHa: 5.5,
    nPerTon: 52,
    p2o5PerTon: 24,
    k2oPerTon: 38,
  },
  {
    id: 'alfalfa',
    name: 'یونجه علوفه‌ای (آذربایجان شرقی)',
    scientificName: 'Medicago sativa',
    kcMid: 1.15,
    rootDepthCm: 120,
    depletionFractionP: 0.55,
    defaultTargetYieldTonHa: 14.0,
    minYieldTonHa: 8.0,
    maxYieldTonHa: 22.0,
    nPerTon: 8, // Nitrogen fixing legume
    p2o5PerTon: 14,
    k2oPerTon: 25,
  },
];

export const REGIONS_DATA: RegionDataset[] = [
  {
    id: 'sarab-plain',
    name: 'دشت سراب و مهربان',
    province: 'آذربایجان شرقی',
    sentinelTile: 'T38TML · Sentinel-2B L2A',
    acquisitionDate: '۱۴۰۵/۰۷/۱۴ — 07:42 UTC',
    passDirection: 'Descending',
    cloudCoverPct: 1.8,
    lat: 37.9408,
    lon: 47.5367,
    utmZone: '38S 722840E 4202410N',
    elevationM: 1680,
    imageAsset: eastAzSatelliteImg,
    climateSummary: 'اقلیم سرد و نیمه‌خشک کوهستانی (دامنه سبلان و بزقوش)',
    dominantCrops: ['سیب‌زمینی', 'گندم آبی', 'یونجه', 'جو'],
    defaultCropId: 'potato',
    timeSeriesNDVI: [
      { date: '۱۵ فروردین', ndvi: 0.24, ndmi: 0.12, regionalAvg: 0.22 },
      { date: '۱ اردیبهشت', ndvi: 0.39, ndmi: 0.21, regionalAvg: 0.35 },
      { date: '۱۵ اردیبهشت', ndvi: 0.58, ndmi: 0.31, regionalAvg: 0.50 },
      { date: '۱ خرداد', ndvi: 0.74, ndmi: 0.38, regionalAvg: 0.64 },
      { date: '۱۵ خرداد', ndvi: 0.79, ndmi: 0.34, regionalAvg: 0.68 },
      { date: '۱ تیر', ndvi: 0.71, ndmi: 0.22, regionalAvg: 0.61 },
      { date: '۱۵ مهر (فعلی)', ndvi: 0.66, ndmi: 0.26, regionalAvg: 0.57 },
    ],
    parcels: [
      {
        id: 'SRB-P01',
        name: 'قطعه شمالی — مزرعه سیب‌زمینی آگریا',
        code: 'AZ-SRB-101',
        areaHa: 14.5,
        crop: 'سیب‌زمینی (مرحله حجیم‌شدن غده)',
        growthStage: 'BBCH 45 · حجیم‌شدن غده',
        polygon: [
          [12, 16],
          [44, 14],
          [46, 46],
          [14, 48],
        ],
        center: [29, 31],
        bands: {
          B2_Blue: 0.042,
          B3_Green: 0.078,
          B4_Red: 0.054,
          B5_RedEdge1: 0.148,
          B8_NIR: 0.432,
          B8A_NarrowNIR: 0.455,
          B11_SWIR1: 0.215,
          B12_SWIR2: 0.118,
        },
        sar: { vvDb: -10.8, vhDb: -16.9 },
        soil: {
          organicCarbonPct: 1.42,
          ph: 7.4,
          ecDsM: 1.35,
          nitrogenMgKg: 24.5,
          phosphorusMgKg: 14.2,
          potassiumMgKg: 195,
          zincMgKg: 0.85,
          volumetricMoisturePct: 24.8,
          fieldCapacityPct: 33.0,
          wiltingPointPct: 14.0,
          texture: 'لوم رسی سیلتی (Silty Clay Loam)',
        },
        dlDiagnosis: {
          modelName: 'ResUNet-3D + Spectral BiLSTM v3.2',
          confidencePct: 96.4,
          status: 'nominal',
          statusLabel: '● پوشش مطلوب (کمبود جزئی پتاسیم)',
          primaryFinding: 'تراکم کلروفیل بالا؛ تخلیه پتاسیم قابل‌جذب در فاز انتقال نشاسته به غده.',
          actionSummary: 'کوددهی سرک سولفات پتاسیم محلول‌پاشی/کودآبیاری و حفظ رطوبت بالای ۶۵٪ ظرفیت زراعی.',
        },
      },
      {
        id: 'SRB-P02',
        name: 'قطعه مرکزی — گندم آبی پیشگام',
        code: 'AZ-SRB-102',
        areaHa: 22.0,
        crop: 'گندم آبی (پنجه‌زنی / ساقه‌روی)',
        growthStage: 'BBCH 32 · ظهور گره دوم ساقه',
        polygon: [
          [48, 15],
          [86, 18],
          [84, 52],
          [49, 49],
        ],
        center: [67, 34],
        bands: {
          B2_Blue: 0.058,
          B3_Green: 0.089,
          B4_Red: 0.092,
          B5_RedEdge1: 0.162,
          B8_NIR: 0.348,
          B8A_NarrowNIR: 0.362,
          B11_SWIR1: 0.268,
          B12_SWIR2: 0.172,
        },
        sar: { vvDb: -12.6, vhDb: -18.9 },
        soil: {
          organicCarbonPct: 0.94,
          ph: 7.7,
          ecDsM: 1.82,
          nitrogenMgKg: 14.2,
          phosphorusMgKg: 9.8,
          potassiumMgKg: 230,
          zincMgKg: 0.62,
          volumetricMoisturePct: 19.2,
          fieldCapacityPct: 32.0,
          wiltingPointPct: 14.5,
          texture: 'لوم رسی (Clay Loam)',
        },
        dlDiagnosis: {
          modelName: 'ResUNet-3D + Spectral BiLSTM v3.2',
          confidencePct: 94.8,
          status: 'warning',
          statusLabel: '▲ تنش نیتروژن و رطوبت سطحی',
          primaryFinding: 'افت بازتاب باند Red-Edge (705nm) نشان‌دهنده کمبود ازت و روی در نیمه شرقی قطعه.',
          actionSummary: 'تقسیط نوبت دوم کود اوره به همراه سولفات روی و آبیاری ظرف ۳۶ ساعت آینده.',
        },
      },
      {
        id: 'SRB-P03',
        name: 'قطعه جنوبی — یونجه چین دوم',
        code: 'AZ-SRB-103',
        areaHa: 11.2,
        crop: 'یونجه همدانی (رشد مجدد)',
        growthStage: 'BBCH 28 · توسعه شاخساره فرعی',
        polygon: [
          [16, 53],
          [78, 56],
          [75, 86],
          [15, 84],
        ],
        center: [46, 70],
        bands: {
          B2_Blue: 0.045,
          B3_Green: 0.072,
          B4_Red: 0.048,
          B5_RedEdge1: 0.174,
          B8_NIR: 0.492,
          B8A_NarrowNIR: 0.512,
          B11_SWIR1: 0.194,
          B12_SWIR2: 0.105,
        },
        sar: { vvDb: -9.9, vhDb: -15.8 },
        soil: {
          organicCarbonPct: 1.68,
          ph: 7.3,
          ecDsM: 1.15,
          nitrogenMgKg: 31.0,
          phosphorusMgKg: 11.4,
          potassiumMgKg: 215,
          zincMgKg: 1.10,
          volumetricMoisturePct: 27.5,
          fieldCapacityPct: 34.0,
          wiltingPointPct: 15.0,
          texture: 'لوم سیلتی حاصلخیز (Silt Loam)',
        },
        dlDiagnosis: {
          modelName: 'ResUNet-3D + Spectral BiLSTM v3.2',
          confidencePct: 97.9,
          status: 'nominal',
          statusLabel: '● سلامت زیستی و رطوبت عالی',
          primaryFinding: 'تثبیت بیولوژیک نیتروژن فعال؛ نیاز به تقویت فسفر برای توسعه ریشه پس از چین.',
          actionSummary: 'اعمال سوپرفسفات تریپل یا مونوآمونیوم فسفات در آبیاری بعدی.',
        },
      },
    ],
  },
  {
    id: 'maragheh-bonab',
    name: 'مراغه، بناب و ملکان (دامنه جنوبی سهند)',
    province: 'آذربایجان شرقی',
    sentinelTile: 'T38SLK · Sentinel-2A L2A',
    acquisitionDate: '۱۴۰۵/۰۷/۱۵ — 07:45 UTC',
    passDirection: 'Descending',
    cloudCoverPct: 0.4,
    lat: 37.3892,
    lon: 46.2375,
    utmZone: '38S 609510E 4138420N',
    elevationM: 1475,
    imageAsset: eastAzSatelliteImg,
    climateSummary: 'اقلیم معتدل کوهپایه‌ای با تابش مطلوب و رسوبات آبرفتی صوفی‌چای',
    dominantCrops: ['باغات سیب صادراتی', 'انگور بی‌دانه ملکان', 'گندم', 'گردو'],
    defaultCropId: 'apple',
    timeSeriesNDVI: [
      { date: '۱۵ فروردین', ndvi: 0.31, ndmi: 0.18, regionalAvg: 0.28 },
      { date: '۱ اردیبهشت', ndvi: 0.48, ndmi: 0.27, regionalAvg: 0.42 },
      { date: '۱۵ اردیبهشت', ndvi: 0.65, ndmi: 0.35, regionalAvg: 0.56 },
      { date: '۱ خرداد', ndvi: 0.77, ndmi: 0.41, regionalAvg: 0.66 },
      { date: '۱۵ خرداد', ndvi: 0.81, ndmi: 0.39, regionalAvg: 0.70 },
      { date: '۱ تیر', ndvi: 0.76, ndmi: 0.31, regionalAvg: 0.65 },
      { date: '۱۵ مهر (فعلی)', ndvi: 0.69, ndmi: 0.28, regionalAvg: 0.60 },
    ],
    parcels: [
      {
        id: 'MRG-P01',
        name: 'بلوک A — باغ سیب رد و گلدن دلیشز مراغه',
        code: 'AZ-MRG-201',
        areaHa: 9.8,
        crop: 'باغ سیب پایه رویشی M9',
        growthStage: 'BBCH 77 · رشد نهایی و رنگ‌گیری میوه',
        polygon: [
          [10, 14],
          [48, 12],
          [45, 50],
          [11, 52],
        ],
        center: [29, 32],
        bands: {
          B2_Blue: 0.038,
          B3_Green: 0.068,
          B4_Red: 0.044,
          B5_RedEdge1: 0.165,
          B8_NIR: 0.468,
          B8A_NarrowNIR: 0.489,
          B11_SWIR1: 0.188,
          B12_SWIR2: 0.098,
        },
        sar: { vvDb: -9.4, vhDb: -15.1 },
        soil: {
          organicCarbonPct: 1.75,
          ph: 7.5,
          ecDsM: 1.45,
          nitrogenMgKg: 26.8,
          phosphorusMgKg: 16.5,
          potassiumMgKg: 180,
          zincMgKg: 0.72,
          volumetricMoisturePct: 25.4,
          fieldCapacityPct: 31.0,
          wiltingPointPct: 13.0,
          texture: 'لوم شنی آبرفتی (Alluvial Loam)',
        },
        dlDiagnosis: {
          modelName: 'OrchardCrown-CNN + Sentinel-2 Fusion',
          confidencePct: 95.8,
          status: 'nominal',
          statusLabel: '● تاج‌پوشش سالم (نیاز کلسیم و روی)',
          primaryFinding: 'شاخص سبزینگی سایه‌انداز درختان یکنواخت؛ کمبود موضعی روی و کلسیم در ردیف‌های غربی.',
          actionSummary: 'کودآبیاری نیترات کلسیم و محلول‌پاشی فروت‌ست (روی-بور) پس از برداشت.',
        },
      },
      {
        id: 'MRG-P02',
        name: 'بلوک B — دشت بناب (اراضی حساس به شوری)',
        code: 'AZ-BNB-202',
        areaHa: 18.4,
        crop: 'گندم و جو پاییزه',
        growthStage: 'BBCH 25 · پنجه‌زنی',
        polygon: [
          [52, 16],
          [88, 18],
          [86, 82],
          [50, 79],
        ],
        center: [69, 49],
        bands: {
          B2_Blue: 0.082,
          B3_Green: 0.114,
          B4_Red: 0.138,
          B5_RedEdge1: 0.178,
          B8_NIR: 0.276,
          B8A_NarrowNIR: 0.288,
          B11_SWIR1: 0.342,
          B12_SWIR2: 0.265,
        },
        sar: { vvDb: -14.2, vhDb: -20.4 },
        soil: {
          organicCarbonPct: 0.68,
          ph: 8.1,
          ecDsM: 4.65,
          nitrogenMgKg: 11.4,
          phosphorusMgKg: 8.2,
          potassiumMgKg: 245,
          zincMgKg: 0.45,
          volumetricMoisturePct: 15.8,
          fieldCapacityPct: 30.0,
          wiltingPointPct: 14.0,
          texture: 'لوم رسی آهکی نیمه‌شور',
        },
        dlDiagnosis: {
          modelName: 'SalinityNet-S2 + SAR Moisture Inversion',
          confidencePct: 93.2,
          status: 'critical',
          statusLabel: '✖ تنش شوری خاک (EC > 4 dS/m) و کمبود ماده آلی',
          primaryFinding: 'افزایش بازتاب باندهای SWIR1/SWIR2 و شاخص شوری NDSI در حاشیه غربی به سمت حوضه دریاچه ارومیه.',
          actionSummary: 'مصرف هیومیک اسید + گوگرد بنتونیت‌دار، جایگزینی اوره با سولفات آمونیوم و اعمال آبشویی ملایم.',
        },
      },
    ],
  },
  {
    id: 'tabriz-shabestar',
    name: 'دشت تبریز، شبستر و آذرشهر',
    province: 'آذربایجان شرقی',
    sentinelTile: 'T38TLL · Sentinel-2B L2A',
    acquisitionDate: '۱۴۰۵/۰۷/۱۴ — 07:42 UTC',
    passDirection: 'Descending',
    cloudCoverPct: 2.1,
    lat: 38.1814,
    lon: 45.7028,
    utmZone: '38S 561560E 4226020N',
    elevationM: 1390,
    imageAsset: eastAzSatelliteImg,
    climateSummary: 'اقلیم نیمه‌خشک سرد با تبخیر و تعرق بالا در مجاورت حوضه آبریز دریاچه ارومیه',
    dominantCrops: ['گندم', 'جو', 'پسته و بادام سردسیری', 'آفتابگردان'],
    defaultCropId: 'wheat',
    timeSeriesNDVI: [
      { date: '۱۵ فروردین', ndvi: 0.22, ndmi: 0.09, regionalAvg: 0.20 },
      { date: '۱ اردیبهشت', ndvi: 0.36, ndmi: 0.17, regionalAvg: 0.32 },
      { date: '۱۵ اردیبهشت', ndvi: 0.54, ndmi: 0.25, regionalAvg: 0.47 },
      { date: '۱ خرداد', ndvi: 0.64, ndmi: 0.28, regionalAvg: 0.55 },
      { date: '۱۵ خرداد', ndvi: 0.61, ndmi: 0.21, regionalAvg: 0.52 },
      { date: '۱ تیر', ndvi: 0.49, ndmi: 0.14, regionalAvg: 0.43 },
      { date: '۱۵ مهر (فعلی)', ndvi: 0.52, ndmi: 0.18, regionalAvg: 0.46 },
    ],
    parcels: [
      {
        id: 'TBZ-P01',
        name: 'قطعه ۱ — گندم آبی دشت شبستر',
        code: 'AZ-SHB-301',
        areaHa: 27.5,
        crop: 'گندم آبی (رقم میهن)',
        growthStage: 'BBCH 31 · ابتدای ساقه‌روی',
        polygon: [
          [15, 18],
          [62, 16],
          [60, 78],
          [14, 80],
        ],
        center: [38, 48],
        bands: {
          B2_Blue: 0.064,
          B3_Green: 0.095,
          B4_Red: 0.088,
          B5_RedEdge1: 0.168,
          B8_NIR: 0.365,
          B8A_NarrowNIR: 0.382,
          B11_SWIR1: 0.254,
          B12_SWIR2: 0.168,
        },
        sar: { vvDb: -12.1, vhDb: -18.2 },
        soil: {
          organicCarbonPct: 0.85,
          ph: 7.9,
          ecDsM: 2.65,
          nitrogenMgKg: 15.8,
          phosphorusMgKg: 10.4,
          potassiumMgKg: 210,
          zincMgKg: 0.58,
          volumetricMoisturePct: 18.6,
          fieldCapacityPct: 31.0,
          wiltingPointPct: 14.0,
          texture: 'لوم رسی آهکی (Calcareous Clay Loam)',
        },
        dlDiagnosis: {
          modelName: 'ResUNet-3D + Spectral BiLSTM v3.2',
          confidencePct: 94.1,
          status: 'warning',
          statusLabel: '▲ قلیائیت خاک (pH 7.9) و تثبیت فسفر و آهن',
          primaryFinding: 'آهک فعال خاک باعث کاهش جذب فسفر و ریزمغذی‌ها در بخش مرکزی مزرعه شده است.',
          actionSummary: 'استفاده از کودهای اسیدزا (سولفات آمونیوم + فسفات اوره) و کلات آهن EDDHA.',
        },
      },
    ],
  },
  {
    id: 'miandoab-urmia',
    name: 'دشت میاندوآب، نقده و ارومیه',
    province: 'آذربایجان غربی (غرب کشور)',
    sentinelTile: 'T38SLJ · Sentinel-2A L2A',
    acquisitionDate: '۱۴۰۵/۰۷/۱۵ — 07:46 UTC',
    passDirection: 'Descending',
    cloudCoverPct: 0.9,
    lat: 36.9694,
    lon: 46.1027,
    utmZone: '38S 598120E 4091740N',
    elevationM: 1314,
    imageAsset: westIranSatelliteImg,
    climateSummary: 'جلگه آبرفتی حاصلخیز زرینه‌رود و سیمینه‌رود با پتانسیل عملکرد بسیار بالا',
    dominantCrops: ['چغندرقند', 'باغات سیب', 'گندم آبی', 'ذرت علوفه‌ای'],
    defaultCropId: 'sugarbeet',
    timeSeriesNDVI: [
      { date: '۱۵ فروردین', ndvi: 0.27, ndmi: 0.16, regionalAvg: 0.25 },
      { date: '۱ اردیبهشت', ndvi: 0.45, ndmi: 0.26, regionalAvg: 0.40 },
      { date: '۱۵ اردیبهشت', ndvi: 0.64, ndmi: 0.36, regionalAvg: 0.56 },
      { date: '۱ خرداد', ndvi: 0.78, ndmi: 0.42, regionalAvg: 0.68 },
      { date: '۱۵ خرداد', ndvi: 0.83, ndmi: 0.44, regionalAvg: 0.72 },
      { date: '۱ تیر', ndvi: 0.80, ndmi: 0.38, regionalAvg: 0.69 },
      { date: '۱۵ مهر (فعلی)', ndvi: 0.73, ndmi: 0.33, regionalAvg: 0.63 },
    ],
    parcels: [
      {
        id: 'MND-P01',
        name: 'کشت و صنعت میاندوآب — قطعه چغندرقند',
        code: 'WA-MND-401',
        areaHa: 34.0,
        crop: 'چغندرقند (توسعه غده و ذخیره قند)',
        growthStage: 'BBCH 43 · پوشش کامل ردیف‌ها',
        polygon: [
          [14, 15],
          [56, 15],
          [55, 68],
          [13, 66],
        ],
        center: [35, 41],
        bands: {
          B2_Blue: 0.039,
          B3_Green: 0.074,
          B4_Red: 0.046,
          B5_RedEdge1: 0.172,
          B8_NIR: 0.485,
          B8A_NarrowNIR: 0.506,
          B11_SWIR1: 0.192,
          B12_SWIR2: 0.104,
        },
        sar: { vvDb: -10.1, vhDb: -16.2 },
        soil: {
          organicCarbonPct: 1.58,
          ph: 7.5,
          ecDsM: 1.62,
          nitrogenMgKg: 27.4,
          phosphorusMgKg: 15.1,
          potassiumMgKg: 188,
          zincMgKg: 0.92,
          volumetricMoisturePct: 26.8,
          fieldCapacityPct: 34.0,
          wiltingPointPct: 15.0,
          texture: 'لوم رسی آبرفتی عمیق (Deep Alluvial Clay Loam)',
        },
        dlDiagnosis: {
          modelName: 'SugarBeet-CNN + SWIR Canopy Water Model',
          confidencePct: 97.1,
          status: 'nominal',
          statusLabel: '● رشد رویشی عالی (مدیریت عیار قند)',
          primaryFinding: 'شاخص پوشش گیاهی (NDVI > 0.80)؛ مصرف بیش از حد ازت در این مرحله عیار قند را کاهش می‌دهد.',
          actionSummary: 'قطع کود اوره، مصرف سولفات پتاسیم و اسید بوریک جهت افزایش عیار قند غده.',
        },
      },
      {
        id: 'MND-P02',
        name: 'قطعه شرقی — گندم آبی زرینه‌رود',
        code: 'WA-MND-402',
        areaHa: 19.5,
        crop: 'گندم آبی',
        growthStage: 'BBCH 34 · طویل‌شدن ساقه',
        polygon: [
          [60, 18],
          [89, 20],
          [87, 76],
          [59, 74],
        ],
        center: [74, 47],
        bands: {
          B2_Blue: 0.052,
          B3_Green: 0.084,
          B4_Red: 0.076,
          B5_RedEdge1: 0.158,
          B8_NIR: 0.378,
          B8A_NarrowNIR: 0.395,
          B11_SWIR1: 0.238,
          B12_SWIR2: 0.149,
        },
        sar: { vvDb: -11.7, vhDb: -17.6 },
        soil: {
          organicCarbonPct: 1.21,
          ph: 7.6,
          ecDsM: 1.75,
          nitrogenMgKg: 18.5,
          phosphorusMgKg: 12.0,
          potassiumMgKg: 215,
          zincMgKg: 0.74,
          volumetricMoisturePct: 21.4,
          fieldCapacityPct: 33.0,
          wiltingPointPct: 14.5,
          texture: 'لوم رسی (Clay Loam)',
        },
        dlDiagnosis: {
          modelName: 'ResUNet-3D + Spectral BiLSTM v3.2',
          confidencePct: 95.3,
          status: 'warning',
          statusLabel: '▲ افت رطوبت در لایه توسعه ریشه',
          primaryFinding: 'کاهش شاخص NDMI در نیمه جنوبی قطعه به دلیل عدم یکنواختی پخش آب بارانی.',
          actionSummary: 'تنظیم فشار نازل‌های آبیاری بارانی و اعمال ۴۲ میلی‌متر آبیاری به همراه کود سرک.',
        },
      },
    ],
  },
  {
    id: 'kermanshah-mahidasht',
    name: 'دشت ماهیدشت، اسلام‌آباد و کرمانشاه',
    province: 'کرمانشاه (غرب کشور)',
    sentinelTile: 'T38SMB · Sentinel-2B L2A',
    acquisitionDate: '۱۴۰۵/۰۷/۱۳ — 07:38 UTC',
    passDirection: 'Descending',
    cloudCoverPct: 0.2,
    lat: 34.2653,
    lon: 46.8069,
    utmZone: '38S 666340E 3792810N',
    elevationM: 1365,
    imageAsset: westIranSatelliteImg,
    climateSummary: 'دشت بین‌کوهی زاگرس با خاک‌های عمیق و حاصلخیز و قطب تولید گندم و کلزا در غرب کشور',
    dominantCrops: ['گندم آبی و دیم', 'کلزا', 'ذرت دانه‌ای', 'نخود و چغندرقند'],
    defaultCropId: 'canola',
    timeSeriesNDVI: [
      { date: '۱۵ فروردین', ndvi: 0.42, ndmi: 0.24, regionalAvg: 0.38 },
      { date: '۱ اردیبهشت', ndvi: 0.64, ndmi: 0.34, regionalAvg: 0.57 },
      { date: '۱۵ اردیبهشت', ndvi: 0.78, ndmi: 0.39, regionalAvg: 0.69 },
      { date: '۱ خرداد', ndvi: 0.72, ndmi: 0.31, regionalAvg: 0.63 },
      { date: '۱۵ خرداد', ndvi: 0.55, ndmi: 0.19, regionalAvg: 0.49 },
      { date: '۱ تیر', ndvi: 0.38, ndmi: 0.12, regionalAvg: 0.35 },
      { date: '۱۵ مهر (فعلی)', ndvi: 0.61, ndmi: 0.25, regionalAvg: 0.54 },
    ],
    parcels: [
      {
        id: 'KRM-P01',
        name: 'مزرعه مکانیزه ماهیدشت — کلزا پاییزه',
        code: 'WT-KRM-501',
        areaHa: 42.0,
        crop: 'کلزا (رزت و استقرار پاییزه)',
        growthStage: 'BBCH 19 · مرحله رزت ۸ برگی',
        polygon: [
          [12, 16],
          [76, 15],
          [74, 78],
          [14, 80],
        ],
        center: [44, 47],
        bands: {
          B2_Blue: 0.048,
          B3_Green: 0.081,
          B4_Red: 0.062,
          B5_RedEdge1: 0.159,
          B8_NIR: 0.412,
          B8A_NarrowNIR: 0.431,
          B11_SWIR1: 0.218,
          B12_SWIR2: 0.129,
        },
        sar: { vvDb: -11.1, vhDb: -17.0 },
        soil: {
          organicCarbonPct: 1.34,
          ph: 7.5,
          ecDsM: 1.18,
          nitrogenMgKg: 21.0,
          phosphorusMgKg: 11.8,
          potassiumMgKg: 240,
          zincMgKg: 0.78,
          volumetricMoisturePct: 22.6,
          fieldCapacityPct: 35.0,
          wiltingPointPct: 16.0,
          texture: 'رسی سیلتی عمیق (Silty Clay)',
        },
        dlDiagnosis: {
          modelName: 'CanolaNet-S2 + SAR Biomass Estimator',
          confidencePct: 96.0,
          status: 'nominal',
          statusLabel: '● استقرار یکنواخت (نیاز گوگرد و ازت)',
          primaryFinding: 'تراکم بوته کلزا پیش از سرمای زمستانه استاندارد است؛ گیاه کلزا نیاز بالایی به گوگرد و روی دارد.',
          actionSummary: 'تغذیه سولفات آمونیوم به همراه سولفات روی و بور جهت افزایش مقاومت به سرمازدگی.',
        },
      },
    ],
  },
];
