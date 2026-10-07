import { CropParameter, ParcelZone } from '../data/regionsData';

export interface SpectralIndices {
  ndvi: number;  // (B8 - B4) / (B8 + B4)
  ndmi: number;  // (B8 - B11) / (B8 + B11)
  ndre: number;  // (B8A - B5) / (B8A + B5)
  bsi: number;   // ((B11 + B4) - (B8 + B2)) / ((B11 + B4) + (B8 + B2))
  savi: number;  // ((B8 - B4) / (B8 + B4 + 0.5)) * 1.5
  ndsi: number;  // (B11 - B12) / (B11 + B12) or Salinity Proxy
  sarMoistureIndex: number; // Normalized SAR VV/VH moisture indicator (0-100%)
  overallHealthScore: number; // 0-100 empirical composite
}

export function calculateSpectralIndices(parcel: ParcelZone): SpectralIndices {
  const { B2_Blue, B4_Red, B5_RedEdge1, B8_NIR, B8A_NarrowNIR, B11_SWIR1, B12_SWIR2 } = parcel.bands;

  const ndvi = (B8_NIR - B4_Red) / Math.max(0.0001, B8_NIR + B4_Red);
  const ndmi = (B8_NIR - B11_SWIR1) / Math.max(0.0001, B8_NIR + B11_SWIR1);
  const ndre = (B8A_NarrowNIR - B5_RedEdge1) / Math.max(0.0001, B8A_NarrowNIR + B5_RedEdge1);
  const bsiNum = (B11_SWIR1 + B4_Red) - (B8_NIR + B2_Blue);
  const bsiDen = Math.max(0.0001, (B11_SWIR1 + B4_Red) + (B8_NIR + B2_Blue));
  const bsi = bsiNum / bsiDen;
  const L = 0.5;
  const savi = ((B8_NIR - B4_Red) / Math.max(0.0001, B8_NIR + B4_Red + L)) * (1 + L);
  const ndsi = Math.sqrt(Math.max(0, B4_Red * B11_SWIR1)) + (B12_SWIR2 * 0.4);

  // SAR VV (-16 dB dry to -8 dB wet)
  const sarMoistureIndex = Math.min(100, Math.max(10, ((parcel.sar.vvDb + 16) / 8) * 100));

  const salinityPenalty = parcel.soil.ecDsM > 2.5 ? (parcel.soil.ecDsM - 2.5) * 6 : 0;
  const rawScore = (ndvi * 55) + ((ndmi + 0.3) * 35) + (ndre * 25) - salinityPenalty;
  const overallHealthScore = Math.round(Math.min(99, Math.max(32, rawScore)));

  return {
    ndvi: Number(ndvi.toFixed(3)),
    ndmi: Number(ndmi.toFixed(3)),
    ndre: Number(ndre.toFixed(3)),
    bsi: Number(bsi.toFixed(3)),
    savi: Number(savi.toFixed(3)),
    ndsi: Number(ndsi.toFixed(3)),
    sarMoistureIndex: Number(sarMoistureIndex.toFixed(1)),
    overallHealthScore,
  };
}

export interface FertilizerPrescriptionItem {
  id: string;
  fertilizerName: string;
  formula: string;
  dosageKgHa: number;
  totalFarmKg: number;
  bags50Kg: number;
  applicationMethod: string;
  timingStage: string;
  priority: 'critical' | 'recommended' | 'maintenance';
  priorityLabel: string;
  scientificReason: string;
}

export function generateFertilizerPrescription(
  parcel: ParcelZone,
  crop: CropParameter,
  targetYieldTonHa: number,
  customAreaHa: number
): FertilizerPrescriptionItem[] {
  const indices = calculateSpectralIndices(parcel);
  const { soil } = parcel;

  // 1. Nitrogen (Urea 46% or Ammonium Sulfate 21% if pH >= 7.8 or EC > 2.5)
  const totalNRequired = crop.nPerTon * targetYieldTonHa;
  const soilNSupply = soil.nitrogenMgKg * 2.2 + soil.organicCarbonPct * 18;
  // Adjust by satellite NDRE (Red-Edge chlorophyll)
  const ndreFactor = indices.ndre < 0.38 ? 1.18 : indices.ndre > 0.50 ? 0.85 : 1.0;
  const netNDeficit = Math.max(15, (totalNRequired - soilNSupply) * ndreFactor);

  const useAmmoniumSulfate = soil.ph >= 7.75 || soil.ecDsM >= 2.4 || crop.id === 'canola';
  const nFertilizerRate = useAmmoniumSulfate
    ? Math.round(netNDeficit / 0.21) // Ammonium Sulfate (21% N + 24% S)
    : Math.round(netNDeficit / 0.46); // Urea (46% N)

  // 2. Phosphorus (MAP 12-61-0 or TSP 46% P2O5)
  const totalP2O5Required = crop.p2o5PerTon * targetYieldTonHa;
  const soilPSupply = Math.max(0, (soil.phosphorusMgKg - 6) * 4.5);
  const netP2O5Deficit = Math.max(12, totalP2O5Required - soilPSupply);
  const mapDosage = Math.round(netP2O5Deficit / 0.52);

  // 3. Potassium (Potassium Sulfate SOP 50% K2O - Chlorine-free for Iranian calcareous soils)
  const totalK2ORequired = crop.k2oPerTon * targetYieldTonHa;
  const soilKSupply = Math.max(0, (soil.potassiumMgKg - 140) * 0.85);
  const netK2ODeficit = Math.max(20, totalK2ORequired - soilKSupply);
  const sopDosage = Math.round(netK2ODeficit / 0.50);

  // 4. Zinc Sulfate / Micronutrient based on DTPA Zn & calcareous pH
  const znDeficit = soil.zincMgKg < 0.9 || soil.ph >= 7.7;
  const znDosage = znDeficit ? (soil.zincMgKg < 0.65 ? 35 : 22) : 12;

  // 5. Humic Acid + Soil Conditioner (based on BSI bare soil index, Organic Carbon, and ECe salinity)
  const humicDosage = soil.ecDsM > 2.5 ? 18 : soil.organicCarbonPct < 1.1 ? 14 : 8;

  const items: FertilizerPrescriptionItem[] = [
    {
      id: 'fert-n',
      fertilizerName: useAmmoniumSulfate
        ? 'سولفات آمونیوم گرانوله (اسیدزا و اصلاح‌کننده قلیائیت)'
        : 'اوره کشاورزی ۴۶٪ (تقسیط سرک)',
      formula: useAmmoniumSulfate ? '(NH₄)₂SO₄ · 21% N + 24% S' : 'CO(NH₂)₂ · 46% N',
      dosageKgHa: nFertilizerRate,
      totalFarmKg: Math.round(nFertilizerRate * customAreaHa),
      bags50Kg: Math.ceil((nFertilizerRate * customAreaHa) / 50),
      applicationMethod: 'کودآبیاری (تزریق در تانک کود) در ۲ نوبت مساوی',
      timingStage: 'نوبت اول: اکنون · نوبت دوم: ۱۸ روز بعد',
      priority: indices.ndre < 0.42 ? 'critical' : 'recommended',
      priorityLabel: indices.ndre < 0.42 ? '✖ اولویت فوری (کمبود کلروفیل Red-Edge)' : '● توصیه استاندارد عملکرد',
      scientificReason: useAmmoniumSulfate
        ? `به دلیل pH=${soil.ph} و هدایت الکتریکی EC=${soil.ecDsM} dS/m در خاک منطقه، سولفات آمونیوم به جای اوره تجویز شد تا ضمن تامین ازت و گوگرد، pH ریزوسفر ریشه کاهش یابد.`
        : `بر اساس شاخص ماهواره‌ای NDRE=${indices.ndre} و نیتروژن قابل جذب ${soil.nitrogenMgKg} mg/kg، این مقدار برای دستیابی به عملکرد هدف ${targetYieldTonHa} تن در هکتار الزامی است.`,
    },
    {
      id: 'fert-p',
      fertilizerName: 'مونوآمونیوم فسفات (MAP) یا سوپرفسفات تریپل',
      formula: 'NH₄H₂PO₄ · 12% N + 61% P₂O₅',
      dosageKgHa: mapDosage,
      totalFarmKg: Math.round(mapDosage * customAreaHa),
      bags50Kg: Math.ceil((mapDosage * customAreaHa) / 50),
      applicationMethod: 'کودآبیاری یا نوارگذاری در عمق توسعه ریشه',
      timingStage: 'همراه با اولین آبیاری پیش‌رو',
      priority: soil.phosphorusMgKg < 11 ? 'critical' : 'recommended',
      priorityLabel: soil.phosphorusMgKg < 11 ? '▲ کمبود فسفر قابل جذب' : '● تقویت سیستم ریشه‌ای',
      scientificReason: `فسفر اولسن خاک ${soil.phosphorusMgKg} mg/kg است. استفاده از فرم محلول مونوآمونیوم فسفات مانع از رسوب فسفر توسط آهک خاک‌های آذربایجان و غرب کشور می‌شود.`,
    },
    {
      id: 'fert-k',
      fertilizerName: 'سولفات پتاسیم محلول (SOP بدون کلر)',
      formula: 'K₂SO₄ · 50% K₂O + 18% S',
      dosageKgHa: sopDosage,
      totalFarmKg: Math.round(sopDosage * customAreaHa),
      bags50Kg: Math.ceil((sopDosage * customAreaHa) / 50),
      applicationMethod: 'کودآبیاری در فاز زایشی / حجیم‌شدن دانه و غده',
      timingStage: 'طی ۲ نوبت آبیاری متوالی',
      priority: soil.potassiumMgKg < 200 || crop.id === 'potato' || crop.id === 'sugarbeet' ? 'critical' : 'recommended',
      priorityLabel:
        soil.potassiumMgKg < 200 || crop.id === 'potato' || crop.id === 'sugarbeet'
          ? '▲ حیاتی برای وزن مخصوص و مقاومت به خشکی'
          : '● تعادل اسمزی سلول',
      scientificReason: `پتاسیم تبادلی خاک ${soil.potassiumMgKg} mg/kg و شاخص رطوبت تاج‌پوشش NDMI=${indices.ndmi} است. پتاسیم تنظیم‌کننده روزنه‌های برگ در برابر تنش کم‌آبی و سرمازدگی است.`,
    },
    {
      id: 'fert-zn',
      fertilizerName: 'سولفات روی + کلات ریزمغذی (روی، آهن، بور)',
      formula: 'ZnSO₄·7H₂O (34% Zn) + Fe-EDDHA',
      dosageKgHa: znDosage,
      totalFarmKg: Math.round(znDosage * customAreaHa),
      bags50Kg: Math.max(1, Math.ceil((znDosage * customAreaHa) / 25)),
      applicationMethod: 'محلول‌پاشی برگی (۴ در هزار) یا کودآبیاری',
      timingStage: 'عصرهنگام در دمای زیر ۲۲ درجه سانتی‌گراد',
      priority: znDeficit ? 'critical' : 'maintenance',
      priorityLabel: znDeficit ? '▲ کمبود روی (${soil.zincMgKg} mg/kg)' : '● حفظ سنتز اکسین',
      scientificReason: `غلظت روی قابل جذب خاک ${soil.zincMgKg} mg/kg است (حد بحرانی ۱.۰ میلی‌گرم بر کیلوگرم). کمبود روی در خاک‌های آهکی غرب ایران عامل اصلی کوتاهی میان‌گره و کاهش سایز دانه/میوه است.`,
    },
    {
      id: 'fert-humic',
      fertilizerName: 'اسید هیومیک و فولویک پودری (اصلاح‌کننده ساختار و شوری خاک)',
      formula: 'Humic Acid 65% + Fulvic Acid 15% + K₂O 10%',
      dosageKgHa: humicDosage,
      totalFarmKg: Math.round(humicDosage * customAreaHa),
      bags50Kg: Math.max(1, Math.ceil((humicDosage * customAreaHa) / 20)),
      applicationMethod: 'حل در تانک کود و تزریق در انتهای آبیاری',
      timingStage: 'در آبیاری نوبت اول',
      priority: soil.ecDsM > 2.0 || soil.organicCarbonPct < 1.2 ? 'critical' : 'maintenance',
      priorityLabel:
        soil.ecDsM > 2.0
          ? `✖ تعدیل تنش شوری (EC=${soil.ecDsM} dS/m)`
          : `● ارتقای کربن آلی (SOC=${soil.organicCarbonPct}%)`,
      scientificReason: `شاخص خاک لخت BSI=${indices.bsi} و کربن آلی خاک ${soil.organicCarbonPct}% است. اسید هیومیک ظرفیت تبادل کاتیونی (CEC) و نگهداری رطوبت در ناحیه ریشه را تا ۲۲٪ افزایش می‌دهد.`,
    },
  ];

  return items;
}

export interface DailyWeatherForecast {
  dateIso: string;
  persianDay: string;
  tempMaxC: number;
  tempMinC: number;
  precipitationMm: number;
  et0Mm: number;       // FAO-56 Reference Evapotranspiration
  etcMm: number;       // Crop Evapotranspiration (ET0 * Kc)
  projectedMoisturePct: number; // Simulated % VWC before irrigation
  stressThresholdPct: number;   // Critical % VWC threshold (RAW boundary)
  needsIrrigation: boolean;
}

export interface IrrigationPlanResult {
  currentVwcPct: number;
  fieldCapacityPct: number;
  wiltingPointPct: number;
  criticalThresholdPct: number;
  tawMm: number; // Total Available Water in root zone (mm)
  rawMm: number; // Readily Available Water (mm)
  currentDepletionMm: number;
  daysUntilStress: number;
  recommendedDatePersian: string;
  recommendedWindow: string;
  netIrrigationDepthMm: number;
  grossIrrigationDepthMm: number;
  volumePerHaM3: number;
  totalFarmVolumeM3: number;
  pumpOperationHours: number;
  leachingFractionPct: number;
  forecastDays: DailyWeatherForecast[];
  isLiveMeteo: boolean;
}

const PERSIAN_WEEKDAYS = ['یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنج‌شنبه', 'جمعه', 'شنبه'];

export function computeIrrigationSchedule(
  parcel: ParcelZone,
  crop: CropParameter,
  irrigationEfficiencyPct: number, // e.g., 85% Drip, 72% Sprinkler, 55% Surface
  pumpFlowLitersPerSec: number,
  customAreaHa: number,
  liveMeteo?: {
    dates: string[];
    tempMax: number[];
    tempMin: number[];
    precip: number[];
    et0: number[];
  }
): IrrigationPlanResult {
  const { volumetricMoisturePct, fieldCapacityPct, wiltingPointPct, ecDsM } = parcel.soil;
  const rootDepthMm = crop.rootDepthCm * 10;

  // Total Available Water (TAW) in mm = 1000 * (theta_FC - theta_WP) * Zr
  const tawMm = ((fieldCapacityPct - wiltingPointPct) / 100) * rootDepthMm;
  // Readily Available Water (RAW) in mm = p * TAW
  const rawMm = tawMm * crop.depletionFractionP;
  // Critical VWC % below which water stress begins
  const criticalThresholdPct = Number(
    (fieldCapacityPct - (fieldCapacityPct - wiltingPointPct) * crop.depletionFractionP).toFixed(1)
  );

  const currentDepletionMm = Math.max(
    0,
    ((fieldCapacityPct - volumetricMoisturePct) / 100) * rootDepthMm
  );

  // Build 7-day forecast using live Open-Meteo or regional agro-climatic baseline
  const forecastDays: DailyWeatherForecast[] = [];
  let runningVwc = volumetricMoisturePct;
  let daysUntilStress = -1;

  const baseDates = liveMeteo?.dates?.length === 7
    ? liveMeteo.dates
    : Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() + i);
        return d.toISOString().split('T')[0];
      });

  for (let i = 0; i < 7; i++) {
    const dObj = new Date(baseDates[i] + 'T12:00:00');
    const dayName = i === 0 ? 'امروز' : i === 1 ? 'فردا' : PERSIAN_WEEKDAYS[dObj.getDay()];
    const tempMaxC = liveMeteo ? Number(liveMeteo.tempMax[i].toFixed(1)) : Number((21.5 - i * 0.4 + (i % 2) * 1.1).toFixed(1));
    const tempMinC = liveMeteo ? Number(liveMeteo.tempMin[i].toFixed(1)) : Number((7.8 - i * 0.3).toFixed(1));
    const precipitationMm = liveMeteo ? Number(liveMeteo.precip[i].toFixed(1)) : (i === 5 ? 2.4 : 0.0);
    const et0Mm = liveMeteo ? Number(liveMeteo.et0[i].toFixed(2)) : Number((4.35 - i * 0.12).toFixed(2));
    const etcMm = Number((et0Mm * crop.kcMid).toFixed(2));

    // Effective rainfall (75% of rainfall > 2mm)
    const effectiveRainMm = precipitationMm > 2.0 ? precipitationMm * 0.75 : 0;
    const netDailyLossMm = Math.max(0, etcMm - effectiveRainMm);

    // Convert mm water loss to % VWC drop in root zone
    const vwcDropPct = (netDailyLossMm / rootDepthMm) * 100;
    if (i > 0) {
      runningVwc = Math.max(wiltingPointPct + 0.5, Number((runningVwc - vwcDropPct).toFixed(1)));
    }

    const needsIrrigation = runningVwc <= criticalThresholdPct;
    if (needsIrrigation && daysUntilStress === -1) {
      daysUntilStress = i;
    }

    forecastDays.push({
      dateIso: baseDates[i],
      persianDay: `${dayName} (${baseDates[i].slice(5).replace('-', '/')})`,
      tempMaxC,
      tempMinC,
      precipitationMm,
      et0Mm,
      etcMm,
      projectedMoisturePct: runningVwc,
      stressThresholdPct: criticalThresholdPct,
      needsIrrigation,
    });
  }

  if (daysUntilStress === -1) {
    daysUntilStress = 6;
  }

  // Leaching Requirement (LR) for salinity control if EC > 2.2 dS/m
  const leachingFractionPct = ecDsM > 3.5 ? 16 : ecDsM > 2.2 ? 9 : 4;

  // Net depth to refill root zone to Field Capacity at recommended irrigation time
  const targetRefillMm = Math.max(22, currentDepletionMm + (daysUntilStress * 4.2));
  const netIrrigationDepthMm = Number(Math.min(rawMm * 1.15, targetRefillMm).toFixed(1));
  const grossIrrigationDepthMm = Number(
    ((netIrrigationDepthMm / (irrigationEfficiencyPct / 100)) * (1 + leachingFractionPct / 100)).toFixed(1)
  );

  // 1 mm depth on 1 ha = 10 m³ water
  const volumePerHaM3 = Math.round(grossIrrigationDepthMm * 10);
  const totalFarmVolumeM3 = Math.round(volumePerHaM3 * customAreaHa);

  // Pump hours = Total Volume (Liters) / (Flow L/s * 3600)
  const totalLiters = totalFarmVolumeM3 * 1000;
  const pumpOperationHours = Number((totalLiters / Math.max(1, pumpFlowLitersPerSec * 3600)).toFixed(1));

  const recommendedDayObj = forecastDays[Math.min(daysUntilStress, forecastDays.length - 1)];
  const recommendedDatePersian =
    daysUntilStress === 0
      ? 'فوری — حداکثر تا ۲۴ ساعت آینده'
      : daysUntilStress === 1
      ? `فردا (${recommendedDayObj.persianDay})`
      : `${daysUntilStress} روز دیگر (${recommendedDayObj.persianDay})`;

  return {
    currentVwcPct: volumetricMoisturePct,
    fieldCapacityPct,
    wiltingPointPct,
    criticalThresholdPct,
    tawMm: Number(tawMm.toFixed(1)),
    rawMm: Number(rawMm.toFixed(1)),
    currentDepletionMm: Number(currentDepletionMm.toFixed(1)),
    daysUntilStress,
    recommendedDatePersian,
    recommendedWindow: '۰۵:۳۰ تا ۱۰:۰۰ صبح یا ۱۸:۳۰ به بعد (حداقل تلفات تبخیر و باد)',
    netIrrigationDepthMm,
    grossIrrigationDepthMm,
    volumePerHaM3,
    totalFarmVolumeM3,
    pumpOperationHours,
    leachingFractionPct,
    forecastDays,
    isLiveMeteo: Boolean(liveMeteo),
  };
}
