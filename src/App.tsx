import React, { useEffect, useMemo, useState } from 'react';
import {
  CROP_PARAMETERS,
  CropParameter,
  ParcelZone,
  REGIONS_DATA,
  RegionDataset,
} from './data/regionsData';
import {
  calculateSpectralIndices,
  computeIrrigationSchedule,
  generateFertilizerPrescription,
} from './utils/spectralEngine';
import { SatelliteCanvasMap, SpectralLayerType } from './components/SatelliteCanvasMap';
import { CustomImageLab } from './components/CustomImageLab';
import { LiveSentinelScene, LiveTileExtractionResult } from './utils/liveSentinelService';
import soilSampleImg from './assets/images/soil_spectral_sample_1791362555085.jpg';
import {
  Download,
  Sliders,
  Droplets,
  Sprout,
  RefreshCw,
  Compass,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

type ActiveTab = 'satellite-soil' | 'fertilizer' | 'irrigation' | 'custom-lab';

const IRRIGATION_SYSTEMS = [
  { id: 'drip', label: 'آبیاری قطره‌ای (تیپ / زیرسطحی)', efficiencyPct: 88 },
  { id: 'pivot', label: 'سنترپیوت / لینیر مکانیزه', efficiencyPct: 80 },
  { id: 'sprinkler', label: 'بارانی کلاسیک / ویل‌موو', efficiencyPct: 72 },
  { id: 'surface', label: 'سطحی (جوی و پشته / کرتی)', efficiencyPct: 58 },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('satellite-soil');
  const [selectedRegionId, setSelectedRegionId] = useState<string>(REGIONS_DATA[0].id);
  const selectedRegion: RegionDataset = useMemo(
    () => REGIONS_DATA.find((r) => r.id === selectedRegionId) || REGIONS_DATA[0],
    [selectedRegionId]
  );

  const [selectedParcelId, setSelectedParcelId] = useState<string>(REGIONS_DATA[0].parcels[0].id);
  const selectedParcel: ParcelZone = useMemo(
    () =>
      selectedRegion.parcels.find((p) => p.id === selectedParcelId) ||
      selectedRegion.parcels[0],
    [selectedRegion, selectedParcelId]
  );

  const [activeLayer, setActiveLayer] = useState<SpectralLayerType>('ndvi');
  const [selectedCropId, setSelectedCropId] = useState<string>(REGIONS_DATA[0].defaultCropId);
  const selectedCrop: CropParameter = useMemo(
    () => CROP_PARAMETERS.find((c) => c.id === selectedCropId) || CROP_PARAMETERS[0],
    [selectedCropId]
  );

  const [targetYieldTonHa, setTargetYieldTonHa] = useState<number>(
    CROP_PARAMETERS.find((c) => c.id === REGIONS_DATA[0].defaultCropId)?.defaultTargetYieldTonHa || 42
  );
  const [customAreaHa, setCustomAreaHa] = useState<number>(REGIONS_DATA[0].parcels[0].areaHa);
  const [irrigationSystemId, setIrrigationSystemId] = useState<string>('drip');
  const [pumpFlowLps, setPumpFlowLps] = useState<number>(24);
  const [soilImgError, setSoilImgError] = useState<boolean>(false);

  // Live Satellite STAC & Tile Extraction State
  const [liveExtraction, setLiveExtraction] = useState<LiveTileExtractionResult | null>(null);
  const [liveSceneMeta, setLiveSceneMeta] = useState<LiveSentinelScene | null>(null);
  const [activeCoords, setActiveCoords] = useState<{ lat: number; lon: number }>({
    lat: REGIONS_DATA[0].lat,
    lon: REGIONS_DATA[0].lon,
  });
  const [useLivePixelCalibration, setUseLivePixelCalibration] = useState<boolean>(true);

  // Live Open-Meteo FAO-56 Weather State
  const [liveMeteo, setLiveMeteo] = useState<{
    dates: string[];
    tempMax: number[];
    tempMin: number[];
    precip: number[];
    et0: number[];
  } | undefined>(undefined);
  const [meteoLoading, setMeteoLoading] = useState<boolean>(false);

  // Sync defaults when region changes
  const handleRegionChange = (newRegionId: string) => {
    setSelectedRegionId(newRegionId);
    const reg = REGIONS_DATA.find((r) => r.id === newRegionId);
    if (reg) {
      setSelectedParcelId(reg.parcels[0].id);
      setCustomAreaHa(reg.parcels[0].areaHa);
      setSelectedCropId(reg.defaultCropId);
      setActiveCoords({ lat: reg.lat, lon: reg.lon });
      const cr = CROP_PARAMETERS.find((c) => c.id === reg.defaultCropId);
      if (cr) setTargetYieldTonHa(cr.defaultTargetYieldTonHa);
    }
  };

  const handleParcelSelect = (parcel: ParcelZone) => {
    setSelectedParcelId(parcel.id);
    setCustomAreaHa(parcel.areaHa);
  };

  const handleCropChange = (newCropId: string) => {
    setSelectedCropId(newCropId);
    const cr = CROP_PARAMETERS.find((c) => c.id === newCropId);
    if (cr) setTargetYieldTonHa(cr.defaultTargetYieldTonHa);
  };

  // Fetch real-time 7-day agro-meteorological forecast from Open-Meteo API for active satellite coordinates
  useEffect(() => {
    let isMounted = true;
    setMeteoLoading(true);
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${activeCoords.lat}&longitude=${activeCoords.lon}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,et0_fao_evapotranspiration&timezone=Asia%2FTehran`;

    fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error('Meteo network response not ok');
        return res.json();
      })
      .then((data) => {
        if (!isMounted) return;
        if (data?.daily?.time?.length >= 7) {
          setLiveMeteo({
            dates: data.daily.time.slice(0, 7),
            tempMax: data.daily.temperature_2m_max.slice(0, 7),
            tempMin: data.daily.temperature_2m_min.slice(0, 7),
            precip: data.daily.precipitation_sum.slice(0, 7),
            et0: data.daily.et0_fao_evapotranspiration.slice(0, 7),
          });
        }
        setMeteoLoading(false);
      })
      .catch(() => {
        if (isMounted) {
          setLiveMeteo(undefined);
          setMeteoLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [activeCoords.lat, activeCoords.lon]);

  // Dynamically blend parcel baseline with live satellite pixel extraction when enabled
  const effectiveParcel: ParcelZone = useMemo(() => {
    if (!useLivePixelCalibration || !liveExtraction) return selectedParcel;
    return {
      ...selectedParcel,
      bands: {
        B2_Blue: Number(((selectedParcel.bands.B2_Blue * 0.45) + (liveExtraction.extractedBands.B2_Blue * 0.55)).toFixed(3)),
        B3_Green: Number(((selectedParcel.bands.B3_Green * 0.45) + (liveExtraction.extractedBands.B3_Green * 0.55)).toFixed(3)),
        B4_Red: Number(((selectedParcel.bands.B4_Red * 0.45) + (liveExtraction.extractedBands.B4_Red * 0.55)).toFixed(3)),
        B5_RedEdge1: Number(((selectedParcel.bands.B5_RedEdge1 * 0.45) + (liveExtraction.extractedBands.B5_RedEdge1 * 0.55)).toFixed(3)),
        B8_NIR: Number(((selectedParcel.bands.B8_NIR * 0.45) + (liveExtraction.extractedBands.B8_NIR * 0.55)).toFixed(3)),
        B8A_NarrowNIR: Number(((selectedParcel.bands.B8A_NarrowNIR * 0.45) + (liveExtraction.extractedBands.B8A_NarrowNIR * 0.55)).toFixed(3)),
        B11_SWIR1: Number(((selectedParcel.bands.B11_SWIR1 * 0.45) + (liveExtraction.extractedBands.B11_SWIR1 * 0.55)).toFixed(3)),
        B12_SWIR2: Number(((selectedParcel.bands.B12_SWIR2 * 0.45) + (liveExtraction.extractedBands.B12_SWIR2 * 0.55)).toFixed(3)),
      },
    };
  }, [selectedParcel, liveExtraction, useLivePixelCalibration]);

  // Derived Spectral, Fertilizer, and Irrigation models
  const indices = useMemo(() => calculateSpectralIndices(effectiveParcel), [effectiveParcel]);

  const fertilizerPrescription = useMemo(
    () =>
      generateFertilizerPrescription(
        effectiveParcel,
        selectedCrop,
        targetYieldTonHa,
        customAreaHa
      ),
    [effectiveParcel, selectedCrop, targetYieldTonHa, customAreaHa]
  );

  const selectedIrrigationSys =
    IRRIGATION_SYSTEMS.find((s) => s.id === irrigationSystemId) || IRRIGATION_SYSTEMS[0];

  const irrigationPlan = useMemo(
    () =>
      computeIrrigationSchedule(
        effectiveParcel,
        selectedCrop,
        selectedIrrigationSys.efficiencyPct,
        pumpFlowLps,
        customAreaHa,
        liveMeteo
      ),
    [effectiveParcel, selectedCrop, selectedIrrigationSys, pumpFlowLps, customAreaHa, liveMeteo]
  );

  // Export complete farm prescription report as JSON
  const handleExportReport = () => {
    const payload = {
      platform: 'AzarKesht Sentinel — پایش ماهواره‌ای کشاورزی آذربایجان و غرب کشور',
      generatedAt: new Date().toISOString(),
      region: {
        name: selectedRegion.name,
        province: selectedRegion.province,
        sentinelTile: selectedRegion.sentinelTile,
        coordinates: { lat: selectedRegion.lat, lon: selectedRegion.lon, elevationM: selectedRegion.elevationM },
      },
      parcel: {
        code: selectedParcel.code,
        name: selectedParcel.name,
        areaHa: customAreaHa,
        crop: selectedCrop.name,
        targetYieldTonHa,
      },
      spectralIndices: indices,
      soilProperties: selectedParcel.soil,
      fertilizerPrescription,
      irrigationSchedule: irrigationPlan,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `azarkesht-prescription-${selectedParcel.code}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const spectralBandsChartData = [
    { band: 'B2 Blue', wl: '490nm', val: effectiveParcel.bands.B2_Blue, ref: 0.041 },
    { band: 'B3 Green', wl: '560nm', val: effectiveParcel.bands.B3_Green, ref: 0.075 },
    { band: 'B4 Red', wl: '665nm', val: effectiveParcel.bands.B4_Red, ref: 0.048 },
    { band: 'B5 RedEdge', wl: '705nm', val: effectiveParcel.bands.B5_RedEdge1, ref: 0.165 },
    { band: 'B8 NIR', wl: '842nm', val: effectiveParcel.bands.B8_NIR, ref: 0.465 },
    { band: 'B8A Narrow', wl: '865nm', val: effectiveParcel.bands.B8A_NarrowNIR, ref: 0.485 },
    { band: 'B11 SWIR1', wl: '1610nm', val: effectiveParcel.bands.B11_SWIR1, ref: 0.195 },
    { band: 'B12 SWIR2', wl: '2190nm', val: effectiveParcel.bands.B12_SWIR2, ref: 0.108 },
  ];

  return (
    <div className="min-h-screen bg-[#0B0F17] text-slate-100 flex flex-col">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="flex items-center justify-between px-6 py-3.5 bg-[#0F172A] border-b border-slate-800 sticky top-0 z-30">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('satellite-soil');
          }}
          className="text-lg font-bold tracking-tight text-slate-100 whitespace-nowrap"
        >
          آذرکشت سنتینل
        </a>

        {/* Zone 2: 5 clean text navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
          <button
            onClick={() => setActiveTab('satellite-soil')}
            className={`py-1 transition-colors whitespace-nowrap border-b-2 ${
              activeTab === 'satellite-soil'
                ? 'border-emerald-400 text-slate-100'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            پایش ماهواره‌ای و خاک
          </button>
          <button
            onClick={() => setActiveTab('fertilizer')}
            className={`py-1 transition-colors whitespace-nowrap border-b-2 ${
              activeTab === 'fertilizer'
                ? 'border-emerald-400 text-slate-100'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            تجویز هوشمند کود
          </button>
          <button
            onClick={() => setActiveTab('irrigation')}
            className={`py-1 transition-colors whitespace-nowrap border-b-2 ${
              activeTab === 'irrigation'
                ? 'border-emerald-400 text-slate-100'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            پیش‌بینی زمان آبیاری
          </button>
          <button
            onClick={() => setActiveTab('custom-lab')}
            className={`py-1 transition-colors whitespace-nowrap border-b-2 ${
              activeTab === 'custom-lab'
                ? 'border-emerald-400 text-slate-100'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            پردازش تصویر دلخواه
          </button>
        </nav>

        {/* Zone 3: Primary action */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleExportReport}
            className="px-4 py-2 text-xs font-medium text-white bg-emerald-600 rounded-md hover:bg-emerald-500 transition-colors whitespace-nowrap flex items-center gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            <span>خروجی نسخه زراعی (JSON)</span>
          </button>
        </div>
      </header>

      {/* Mobile Navigation Tabs */}
      <div className="flex md:hidden items-center gap-1 px-4 py-2 bg-[#0F172A] border-b border-slate-800 overflow-x-auto">
        {[
          { id: 'satellite-soil', label: 'پایش خاک' },
          { id: 'fertilizer', label: 'تجویز کود' },
          { id: 'irrigation', label: 'زمان آبیاری' },
          { id: 'custom-lab', label: 'پردازش تصویر' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id as ActiveTab)}
            className={`px-3 py-1.5 text-xs font-medium rounded whitespace-nowrap ${
              activeTab === t.id
                ? 'bg-emerald-600 text-white'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Main Split Workspace Layout (1440px Desktop Presence) */}
      <div className="max-w-[1440px] w-full mx-auto flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 p-4 sm:p-6">
        {/* Left / Right (RTL Start) Parameter & Calibration Control Column (3 cols on lg) */}
        <aside className="lg:col-span-3 space-y-5">
          {/* 1. Region & Sentinel Pass Selector */}
          <div className="bg-[#111827] border border-slate-800 rounded-lg p-4">
            <div className="text-xs font-semibold text-slate-300 mb-3 flex items-center justify-between">
              <span>۰۱. پهنه جغرافیایی (آذربایجان و غرب)</span>
              <Compass className="w-4 h-4 text-emerald-400" />
            </div>

            <div className="space-y-1.5">
              {REGIONS_DATA.map((reg) => {
                const isSelected = reg.id === selectedRegion.id;
                return (
                  <button
                    key={reg.id}
                    onClick={() => handleRegionChange(reg.id)}
                    className={`w-full text-right px-3 py-2.5 rounded border text-xs transition-colors flex flex-col gap-1 ${
                      isSelected
                        ? 'bg-emerald-500/12 border-emerald-500/80 text-slate-100'
                        : 'bg-[#0B0F17] border-slate-800/90 text-slate-400 hover:text-slate-200 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold">{reg.name}</span>
                      {isSelected && <span className="text-emerald-400 font-mono text-[11px]">● فعال</span>}
                    </div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-1.5">
                      <span>{reg.province}</span>
                      <span>·</span>
                      <span className="font-mono" dir="ltr">
                        {reg.sentinelTile.split('·')[0]}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Clean Unboxed Telemetry Metadata (Live Copernicus STAC Connected) */}
            <div className="mt-4 pt-3 border-t border-slate-800 space-y-1.5 text-xs text-slate-400">
              <div className="flex items-center justify-between">
                <span>وضعیت ارتباط ماهواره:</span>
                <span className="font-mono text-emerald-400">
                  {liveSceneMeta ? '● متصل به Copernicus STAC' : '● دریافت زنده تایل مداری'}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>آخرین گذر سنتینل:</span>
                <span className="font-mono text-slate-200" dir="ltr">
                  {liveSceneMeta ? liveSceneMeta.persianDate : selectedRegion.acquisitionDate}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>پوشش ابر / تایل:</span>
                <span className="font-mono text-slate-200" dir="ltr">
                  {liveSceneMeta ? `${liveSceneMeta.cloudCover}% · ${liveSceneMeta.mgrsTile}` : `${selectedRegion.cloudCoverPct}% · ${selectedRegion.elevationM}m`}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>مختصات فعال:</span>
                <span className="font-mono text-cyan-400 text-[11px]" dir="ltr">
                  {activeCoords.lat.toFixed(4)}°N, {activeCoords.lon.toFixed(4)}°E
                </span>
              </div>
              <label className="flex items-center justify-between pt-2 border-t border-slate-800/80 cursor-pointer">
                <span className="text-slate-300">کالیبراسیون خودکار با پیکسل زنده:</span>
                <input
                  type="checkbox"
                  checked={useLivePixelCalibration}
                  onChange={(e) => setUseLivePixelCalibration(e.target.checked)}
                  className="accent-emerald-500 w-4 h-4 cursor-pointer"
                />
              </label>
            </div>
          </div>

          {/* 2. Agronomic & Field Calibration Parameters */}
          <div className="bg-[#111827] border border-slate-800 rounded-lg p-4 space-y-4">
            <div className="text-xs font-semibold text-slate-300 flex items-center justify-between">
              <span>۰۲. کالیبراسیون مزرعه و محصول</span>
              <Sliders className="w-4 h-4 text-emerald-400" />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1.5">
                انتخاب قطعه زراعی (پلیگون ماهواره‌ای)
              </label>
              <select
                value={selectedParcel.id}
                onChange={(e) => {
                  const p = selectedRegion.parcels.find((item) => item.id === e.target.value);
                  if (p) handleParcelSelect(p);
                }}
                className="w-full px-3 py-2 bg-[#0B0F17] border border-slate-700 rounded text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              >
                {selectedRegion.parcels.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name} ({p.areaHa} هکتار)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1.5">
                نوع محصول و ضریب گیاهی (FAO-56 Kc)
              </label>
              <select
                value={selectedCrop.id}
                onChange={(e) => handleCropChange(e.target.value)}
                className="w-full px-3 py-2 bg-[#0B0F17] border border-slate-700 rounded text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              >
                {CROP_PARAMETERS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name} (Kc={c.kcMid})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-400">عملکرد هدف (Target Yield):</span>
                <span className="font-mono font-semibold text-emerald-400 tabular-nums">
                  {targetYieldTonHa.toFixed(1)} تن/هکتار
                </span>
              </div>
              <input
                type="range"
                min={selectedCrop.minYieldTonHa}
                max={selectedCrop.maxYieldTonHa}
                step={0.5}
                value={targetYieldTonHa}
                onChange={(e) => setTargetYieldTonHa(parseFloat(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
              <div className="flex justify-between text-[11px] font-mono text-slate-500">
                <span>حداقل: {selectedCrop.minYieldTonHa}t</span>
                <span>حداکثر: {selectedCrop.maxYieldTonHa}t</span>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-400">مساحت زیر کشت کشاورز:</span>
                <span className="font-mono font-semibold text-slate-200 tabular-nums">
                  {customAreaHa.toFixed(1)} هکتار
                </span>
              </div>
              <input
                type="range"
                min={1}
                max={80}
                step={0.5}
                value={customAreaHa}
                onChange={(e) => setCustomAreaHa(parseFloat(e.target.value))}
                className="w-full accent-emerald-500 cursor-pointer"
              />
            </div>

            <div>
              <label className="block text-xs text-slate-400 mb-1.5">
                سیستم آبیاری مزرعه و راندمان پخش
              </label>
              <select
                value={irrigationSystemId}
                onChange={(e) => setIrrigationSystemId(e.target.value)}
                className="w-full px-3 py-2 bg-[#0B0F17] border border-slate-700 rounded text-xs text-slate-100 focus:outline-none focus:border-emerald-500"
              >
                {IRRIGATION_SYSTEMS.map((sys) => (
                  <option key={sys.id} value={sys.id}>
                    {sys.label} — راندمان {sys.efficiencyPct}%
                  </option>
                ))}
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-slate-400">دبی چاه / پمپ آب:</span>
                <span className="font-mono font-semibold text-cyan-400 tabular-nums">
                  {pumpFlowLps} لیتر/ثانیه
                </span>
              </div>
              <input
                type="range"
                min={5}
                max={75}
                step={1}
                value={pumpFlowLps}
                onChange={(e) => setPumpFlowLps(parseInt(e.target.value, 10))}
                className="w-full accent-cyan-500 cursor-pointer"
              />
            </div>
          </div>

          {/* 3. Soil Sample Calibration Visual Card */}
          <div className="bg-[#111827] border border-slate-800 rounded-lg overflow-hidden">
            {!soilImgError ? (
              <img
                src={soilSampleImg}
                alt="کالیبراسیون طیفی نمونه خاک زراعی آذربایجان"
                referrerPolicy="no-referrer"
                onError={() => setSoilImgError(true)}
                className="w-full h-36 object-cover border-b border-slate-800"
              />
            ) : (
              <div className="w-full h-36 bg-gradient-to-br from-slate-900 to-emerald-950 flex items-center justify-center border-b border-slate-800">
                <Sprout className="w-8 h-8 text-emerald-400" />
              </div>
            )}
            <div className="p-3.5">
              <div className="text-xs font-semibold text-slate-200">
                پروفایل آزمایشگاهی و طیفی خاک (۰ تا ۳۰ سانتی‌متر)
              </div>
              <div className="mt-1 text-xs text-slate-400">
                بافت: {selectedParcel.soil.texture}
              </div>
              <div className="mt-2.5 pt-2.5 border-t border-slate-800 flex items-center justify-between text-xs font-mono tabular-nums">
                <span className="text-slate-300">pH: {selectedParcel.soil.ph}</span>
                <span className="text-slate-600">·</span>
                <span
                  className={
                    selectedParcel.soil.ecDsM > 2.5 ? 'text-amber-400' : 'text-emerald-400'
                  }
                >
                  ECe: {selectedParcel.soil.ecDsM} dS/m
                </span>
                <span className="text-slate-600">·</span>
                <span className="text-cyan-400">SOC: {selectedParcel.soil.organicCarbonPct}%</span>
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content Viewport (9 cols on lg) */}
        <main className="lg:col-span-9 space-y-6">
          {/* Deep Learning Model Status Banner (Single-Elevation, Non-Hue-Only State) */}
          <div className="bg-[#111827] border border-slate-800 rounded-lg p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <span className="font-mono text-emerald-400 font-semibold">
                  {selectedParcel.dlDiagnosis.modelName}
                </span>
                <span aria-hidden="true">·</span>
                <span>اطمینان مدل: <strong className="font-mono text-slate-200">{selectedParcel.dlDiagnosis.confidencePct}%</strong></span>
                <span aria-hidden="true">·</span>
                <span>{selectedParcel.growthStage}</span>
              </div>
              <h1 className="text-base sm:text-lg font-semibold text-slate-100">
                {selectedParcel.name} — {selectedParcel.dlDiagnosis.primaryFinding}
              </h1>
              <p className="text-xs text-slate-300">
                <span className="text-emerald-400 font-medium">اقدام توصیه‌شده: </span>
                {selectedParcel.dlDiagnosis.actionSummary}
              </p>
            </div>

            <div className="shrink-0 flex flex-col items-end gap-1.5">
              <span
                className={`text-xs font-mono font-semibold ${
                  selectedParcel.dlDiagnosis.status === 'nominal'
                    ? 'text-emerald-400'
                    : selectedParcel.dlDiagnosis.status === 'warning'
                    ? 'text-amber-400'
                    : 'text-rose-400'
                }`}
              >
                {selectedParcel.dlDiagnosis.statusLabel}
              </span>
              <div className="text-xs text-slate-400 flex items-center gap-2">
                <span>آبیاری بعدی: <strong className="text-cyan-400 font-mono">{irrigationPlan.recommendedDatePersian}</strong></span>
              </div>
            </div>
          </div>

          {/* TAB 1: SATELLITE & SOIL HEALTH MONITORING */}
          {activeTab === 'satellite-soil' && (
            <div className="space-y-6">
              {/* Interactive Sentinel-2 / Sentinel-1 Canvas Map */}
              <SatelliteCanvasMap
                region={selectedRegion}
                selectedParcel={effectiveParcel}
                onSelectParcel={handleParcelSelect}
                activeLayer={activeLayer}
                onChangeLayer={setActiveLayer}
                onLiveTelemetryUpdate={(extraction, scene, coords) => {
                  setLiveExtraction(extraction);
                  setLiveSceneMeta(scene);
                  setActiveCoords(coords);
                }}
              />

              {/* 6-Metric Spectral & Soil Health Readout Grid (Single-Elevation, Tabular Numerals) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
                <div className="bg-[#111827] border border-slate-800 rounded-lg p-3.5">
                  <div className="text-xs text-slate-400">شاخص پوشش گیاهی (NDVI)</div>
                  <div className="mt-1.5 text-2xl font-mono font-bold text-emerald-400 tabular-nums">
                    {indices.ndvi.toFixed(3)}
                  </div>
                  <div className="mt-1 text-[11px] font-mono text-slate-400">
                    SAVI: {indices.savi.toFixed(3)}
                  </div>
                </div>

                <div className="bg-[#111827] border border-slate-800 rounded-lg p-3.5">
                  <div className="text-xs text-slate-400">شاخص رطوبت تاج‌پوشش (NDMI)</div>
                  <div className="mt-1.5 text-2xl font-mono font-bold text-cyan-400 tabular-nums">
                    {indices.ndmi.toFixed(3)}
                  </div>
                  <div className="mt-1 text-[11px] font-mono text-slate-400">
                    VWC: {selectedParcel.soil.volumetricMoisturePct}%
                  </div>
                </div>

                <div className="bg-[#111827] border border-slate-800 rounded-lg p-3.5">
                  <div className="text-xs text-slate-400">کلروفیل لبه قرمز (NDRE)</div>
                  <div className="mt-1.5 text-2xl font-mono font-bold text-lime-400 tabular-nums">
                    {indices.ndre.toFixed(3)}
                  </div>
                  <div className="mt-1 text-[11px] font-mono text-slate-400">
                    N: {selectedParcel.soil.nitrogenMgKg} mg/kg
                  </div>
                </div>

                <div className="bg-[#111827] border border-slate-800 rounded-lg p-3.5">
                  <div className="text-xs text-slate-400">کربن آلی و خاک لخت (SOC/BSI)</div>
                  <div className="mt-1.5 text-2xl font-mono font-bold text-slate-100 tabular-nums">
                    {selectedParcel.soil.organicCarbonPct}%
                  </div>
                  <div className="mt-1 text-[11px] font-mono text-slate-400">
                    BSI: {indices.bsi.toFixed(3)}
                  </div>
                </div>

                <div className="bg-[#111827] border border-slate-800 rounded-lg p-3.5">
                  <div className="text-xs text-slate-400">هدایت الکتریکی شوری (ECe)</div>
                  <div
                    className={`mt-1.5 text-2xl font-mono font-bold tabular-nums ${
                      selectedParcel.soil.ecDsM > 2.5 ? 'text-amber-400' : 'text-emerald-400'
                    }`}
                  >
                    {selectedParcel.soil.ecDsM}
                    <span className="text-xs font-normal text-slate-400 mr-1">dS/m</span>
                  </div>
                  <div className="mt-1 text-[11px] font-mono text-slate-400">
                    NDSI: {indices.ndsi.toFixed(3)}
                  </div>
                </div>

                <div className="bg-[#111827] border border-slate-800 rounded-lg p-3.5">
                  <div className="text-xs text-slate-400">پراکنش رادار سنتینل-۱ (SAR)</div>
                  <div className="mt-1.5 text-2xl font-mono font-bold text-sky-400 tabular-nums" dir="ltr">
                    {selectedParcel.sar.vvDb}
                    <span className="text-xs font-normal text-slate-400 ml-1">dB</span>
                  </div>
                  <div className="mt-1 text-[11px] font-mono text-slate-400" dir="ltr">
                    VH: {selectedParcel.sar.vhDb} dB
                  </div>
                </div>
              </div>

              {/* Dual Scientific Charts: 1) Sentinel-2 8-Band Spectral Signature, 2) Multi-Temporal NDVI/NDMI */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Chart 1: Sentinel-2 Spectral Reflectance Curve */}
                <div className="bg-[#111827] border border-slate-800 rounded-lg p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <h3 className="text-sm font-semibold text-slate-200">
                        منحنی بازتاب طیفی باندهای سنتینل-۲ (Spectral Signature BOA)
                      </h3>
                      <p className="text-xs text-slate-400 mt-0.5">
                        مقایسه بازتاب قطعه {selectedParcel.code} با منحنی مرجع گیاه سالم در طول‌موج‌های 490nm تا 2190nm
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2.5 pt-2">
                    {spectralBandsChartData.map((b) => {
                      const pct = Math.min(100, Math.round((b.val / 0.55) * 100));
                      const refPct = Math.min(100, Math.round((b.ref / 0.55) * 100));
                      return (
                        <div key={b.band} className="space-y-1">
                          <div className="flex items-center justify-between text-xs font-mono tabular-nums" dir="ltr">
                            <span className="text-slate-300">
                              {b.band} <span className="text-slate-500">({b.wl})</span>
                            </span>
                            <div className="flex items-center gap-3">
                              <span className="text-emerald-400">Parcel: {b.val.toFixed(3)}</span>
                              <span className="text-slate-500">Ref: {b.ref.toFixed(3)}</span>
                            </div>
                          </div>
                          <div className="h-2 bg-[#0B0F17] rounded-xs relative overflow-hidden border border-slate-800/80">
                            <div
                              className="h-full bg-emerald-500/80 rounded-xs transition-transform duration-150"
                              style={{ width: `${pct}%` }}
                            />
                            <div
                              className="absolute top-0 bottom-0 w-0.5 bg-amber-400"
                              style={{ right: `${refPct}%` }}
                              title={`مرجع: ${b.ref}`}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Chart 2: Multi-Temporal Seasonal Phenology & Soil Nutrient Table */}
                <div className="bg-[#111827] border border-slate-800 rounded-lg p-5 flex flex-col justify-between">
                  <div>
                    <h3 className="text-sm font-semibold text-slate-200">
                      سری زمانی پایش ماهواره‌ای فصل زراعی و عناصر غذایی خاک
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      روند تغییرات شاخص سبزینگی (NDVI) و رطوبت (NDMI) در گذرهای ۵ روزه سنتینل-۲A/2B
                    </p>

                    {/* SVG Line Chart for Seasonal NDVI & Regional Average */}
                    <div className="mt-4 bg-[#0B0F17] border border-slate-800 rounded p-3">
                      <svg viewBox="0 0 420 130" className="w-full h-32 overflow-visible">
                        {/* Horizontal Reference Lines */}
                        {[0.2, 0.5, 0.8].map((val, idx) => {
                          const y = 110 - val * 110;
                          return (
                            <g key={idx}>
                              <line
                                x1={30}
                                y1={y}
                                x2={405}
                                y2={y}
                                stroke="#1E293B"
                                strokeDasharray="3 3"
                                strokeWidth="1"
                              />
                              <text
                                x={24}
                                y={y + 3}
                                textAnchor="end"
                                className="fill-slate-500 text-[9px] font-mono"
                              >
                                {val.toFixed(1)}
                              </text>
                            </g>
                          );
                        })}

                        {/* Regional Average Dashed Polyline */}
                        <polyline
                          fill="none"
                          stroke="#64748B"
                          strokeWidth="1.5"
                          strokeDasharray="4 3"
                          points={selectedRegion.timeSeriesNDVI
                            .map((pt, i) => `${40 + i * 58},${110 - pt.regionalAvg * 110}`)
                            .join(' ')}
                        />

                        {/* Parcel NDVI Solid Emerald Polyline */}
                        <polyline
                          fill="none"
                          stroke="#10B981"
                          strokeWidth="2.5"
                          points={selectedRegion.timeSeriesNDVI
                            .map((pt, i) => `${40 + i * 58},${110 - pt.ndvi * 110}`)
                            .join(' ')}
                        />

                        {/* Parcel NDMI Cyan Polyline */}
                        <polyline
                          fill="none"
                          stroke="#06B6D4"
                          strokeWidth="1.8"
                          points={selectedRegion.timeSeriesNDVI
                            .map((pt, i) => `${40 + i * 58},${110 - pt.ndmi * 110}`)
                            .join(' ')}
                        />

                        {/* Data Vertices & X-Axis Labels */}
                        {selectedRegion.timeSeriesNDVI.map((pt, i) => {
                          const cx = 40 + i * 58;
                          const cy = 110 - pt.ndvi * 110;
                          return (
                            <g key={pt.date}>
                              <circle cx={cx} cy={cy} r="3.5" className="fill-emerald-400 stroke-[#0B0F17]" strokeWidth="1.5" />
                              <text
                                x={cx}
                                y={125}
                                textAnchor="middle"
                                className="fill-slate-400 text-[8.5px]"
                              >
                                {pt.date.replace(' (فعلی)', '')}
                              </text>
                            </g>
                          );
                        })}
                      </svg>
                      <div className="flex items-center justify-between text-[11px] text-slate-400 pt-2 border-t border-slate-800/80">
                        <span>● خط سبز: NDVI مزرعه شما</span>
                        <span>● خط فیروزه‌ای: رطوبت NDMI</span>
                        <span>--- خط خاکستری: میانگین دشت {selectedRegion.name}</span>
                      </div>
                    </div>
                  </div>

                  {/* Soil Nutrient Concentration Summary */}
                  <div className="mt-4 grid grid-cols-4 gap-2 pt-3 border-t border-slate-800 text-center">
                    <div className="p-2 bg-[#0B0F17] rounded border border-slate-800/80">
                      <div className="text-[11px] text-slate-400">نیتروژن (N)</div>
                      <div className="font-mono font-semibold text-sm text-slate-100 mt-0.5 tabular-nums">
                        {selectedParcel.soil.nitrogenMgKg} <span className="text-[10px] text-slate-500">mg/kg</span>
                      </div>
                    </div>
                    <div className="p-2 bg-[#0B0F17] rounded border border-slate-800/80">
                      <div className="text-[11px] text-slate-400">فسفر اولسن (P)</div>
                      <div className="font-mono font-semibold text-sm text-slate-100 mt-0.5 tabular-nums">
                        {selectedParcel.soil.phosphorusMgKg} <span className="text-[10px] text-slate-500">mg/kg</span>
                      </div>
                    </div>
                    <div className="p-2 bg-[#0B0F17] rounded border border-slate-800/80">
                      <div className="text-[11px] text-slate-400">پتاسیم (K)</div>
                      <div className="font-mono font-semibold text-sm text-slate-100 mt-0.5 tabular-nums">
                        {selectedParcel.soil.potassiumMgKg} <span className="text-[10px] text-slate-500">mg/kg</span>
                      </div>
                    </div>
                    <div className="p-2 bg-[#0B0F17] rounded border border-slate-800/80">
                      <div className="text-[11px] text-slate-400">روی (Zn)</div>
                      <div className="font-mono font-semibold text-sm text-amber-400 mt-0.5 tabular-nums">
                        {selectedParcel.soil.zincMgKg} <span className="text-[10px] text-slate-500">mg/kg</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Navigation CTA Bar to Fertilizer & Irrigation Tabs */}
              <div className="bg-[#111827] border border-slate-800 rounded-lg p-4 flex flex-wrap items-center justify-between gap-4">
                <div className="text-xs text-slate-300">
                  بر اساس داده‌های طیفی قطعه <strong className="font-mono text-emerald-400">{selectedParcel.code}</strong>، نسخه تغذیه کودی و تقویم آبیاری ۷ روزه برای مساحت <strong className="font-mono text-slate-100">{customAreaHa} هکتار</strong> محاسبه شده است.
                </div>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setActiveTab('fertilizer')}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-medium rounded-md transition-colors whitespace-nowrap"
                  >
                    مشاهده نسخه کوددهی ({fertilizerPrescription.length} ردیف کودی)
                  </button>
                  <button
                    onClick={() => setActiveTab('irrigation')}
                    className="px-4 py-2 bg-[#0F172A] hover:bg-slate-800 text-cyan-300 border border-cyan-500/40 text-xs font-medium rounded-md transition-colors whitespace-nowrap"
                  >
                    مشاهده برنامه آبیاری ({irrigationPlan.volumePerHaM3} مترمکعب/هکتار)
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: PRECISION FERTILIZER RECOMMENDATION */}
          {activeTab === 'fertilizer' && (
            <div className="space-y-6">
              <div className="bg-[#111827] border border-slate-800 rounded-lg p-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-100">
                      نسخه هوشمند تجویز کود با نرخ متغیر (Variable Rate Application - VRA)
                    </h2>
                    <p className="text-xs text-slate-400 mt-1">
                      محاسبه‌شده با تلفیق شاخص کلروفیل لبه قرمز سنتینل-۲ (NDRE={indices.ndre})، کربن آلی خاک (SOC={selectedParcel.soil.organicCarbonPct}%) و اسیدیته خاک (pH={selectedParcel.soil.ph}) برای محصول <strong className="text-slate-200">{selectedCrop.name}</strong> با عملکرد هدف <strong className="font-mono text-emerald-400">{targetYieldTonHa} تن در هکتار</strong>.
                    </p>
                  </div>
                  <div className="text-left font-mono text-xs bg-[#0B0F17] border border-slate-800 px-3.5 py-2 rounded shrink-0">
                    <div className="text-slate-400">مساحت مبنای محاسبه:</div>
                    <div className="text-base font-bold text-emerald-400 tabular-nums">{customAreaHa} هکتار</div>
                  </div>
                </div>

                {/* High-Density Prescription Table */}
                <div className="overflow-x-auto mt-4">
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-xs text-slate-400 bg-[#0F172A]">
                        <th className="py-3 px-3 font-medium">نوع کود و فرمول شیمیایی</th>
                        <th className="py-3 px-3 font-medium text-left">مقدار در هکتار</th>
                        <th className="py-3 px-3 font-medium text-left">کل مزرعه ({customAreaHa} ha)</th>
                        <th className="py-3 px-3 font-medium">روش و زمان مصرف</th>
                        <th className="py-3 px-3 font-medium">وضعیت و اولویت</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80 text-xs">
                      {fertilizerPrescription.map((item) => (
                        <React.Fragment key={item.id}>
                          <tr className="hover:bg-slate-800/30 transition-colors">
                            <td className="py-3.5 px-3">
                              <div className="font-semibold text-slate-100">{item.fertilizerName}</div>
                              <div className="font-mono text-[11px] text-slate-400 mt-0.5" dir="ltr">
                                {item.formula}
                              </div>
                            </td>
                            <td className="py-3.5 px-3 text-left font-mono tabular-nums">
                              <span className="text-base font-bold text-emerald-400">{item.dosageKgHa}</span>
                              <span className="text-[11px] text-slate-400 mr-1">kg/ha</span>
                            </td>
                            <td className="py-3.5 px-3 text-left font-mono tabular-nums">
                              <div className="text-sm font-semibold text-slate-100">
                                {item.totalFarmKg.toLocaleString()} kg
                              </div>
                              <div className="text-[11px] text-slate-400">
                                ≈ {item.bags50Kg} کیسه
                              </div>
                            </td>
                            <td className="py-3.5 px-3">
                              <div className="text-slate-200">{item.applicationMethod}</div>
                              <div className="text-slate-400 text-[11px] mt-0.5">{item.timingStage}</div>
                            </td>
                            <td className="py-3.5 px-3">
                              <span
                                className={`font-medium ${
                                  item.priority === 'critical'
                                    ? 'text-amber-400'
                                    : item.priority === 'recommended'
                                    ? 'text-emerald-400'
                                    : 'text-slate-300'
                                }`}
                              >
                                {item.priorityLabel}
                              </span>
                            </td>
                          </tr>
                          <tr className="bg-[#0B0F17]/60">
                            <td colSpan={5} className="py-2 px-3 text-[11px] text-slate-400">
                              <strong className="text-slate-300">علت علمی تجویز: </strong>
                              {item.scientificReason}
                            </td>
                          </tr>
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Variable Rate Application (VRA) Zone Breakdown */}
              <div className="bg-[#111827] border border-slate-800 rounded-lg p-5">
                <h3 className="text-sm font-semibold text-slate-200 mb-3">
                  جدول تعدیل نرخ متغیر کوددهی (VRA) بر اساس پهنه‌بندی ماهواره‌ای قطعه {selectedParcel.code}
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="p-4 bg-[#0B0F17] border border-slate-800 rounded">
                    <div className="font-semibold text-emerald-400">
                      ● پهنه A: رشد قوی (NDVI &gt; 0.65)
                    </div>
                    <p className="text-slate-400 mt-1.5 leading-relaxed">
                      ۴۵٪ مساحت مزرعه دارای سبزینگی مطلوب است. در این بخش‌ها مصرف کود ازته را <strong className="text-slate-200 font-mono">۱۵٪ کمتر</strong> از میانگین جدول اعمال کنید تا از ورس (خوابیدگی ساقه) و تجمع نیترات جلوگیری شود.
                    </p>
                  </div>
                  <div className="p-4 bg-[#0B0F17] border border-slate-800 rounded">
                    <div className="font-semibold text-amber-400">
                      ▲ پهنه B: پوشش متوسط (0.45 &lt; NDVI &lt; 0.65)
                    </div>
                    <p className="text-slate-400 mt-1.5 leading-relaxed">
                      ۳۵٪ مساحت مزرعه منطبق بر دوز استاندارد جدول بالا (<strong className="text-slate-200 font-mono">۱۰۰٪ دوز پایه</strong>) است. محلول‌پاشی ریزمغذی روی و آهن در این پهنه بیشترین بازده اقتصادی را دارد.
                    </p>
                  </div>
                  <div className="p-4 bg-[#0B0F17] border border-slate-800 rounded">
                    <div className="font-semibold text-rose-400">
                      ✖ پهنه C: نقاط کم‌رشد و حاشیه (NDVI &lt; 0.45)
                    </div>
                    <p className="text-slate-400 mt-1.5 leading-relaxed">
                      ۲۰٪ مساحت قطعه دارای تنش خاک لخت و کمبود ماده آلی است. دوز اسید هیومیک و فسفر را در این نقاط <strong className="text-slate-200 font-mono">۲۵٪ بیشتر</strong> اعمال نمایید.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: IRRIGATION TIMING & SOIL WATER BALANCE FORECAST */}
          {activeTab === 'irrigation' && (
            <div className="space-y-6">
              {/* Top Irrigation Decision Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-[#111827] border border-slate-800 rounded-lg p-4">
                  <div className="text-xs text-slate-400">زمان پیشنهادی آبیاری بعدی</div>
                  <div className="mt-1.5 text-lg font-bold text-cyan-400">
                    {irrigationPlan.recommendedDatePersian}
                  </div>
                  <div className="mt-1 text-[11px] text-slate-400">
                    بازه مجاز: {irrigationPlan.recommendedWindow.split('(')[0]}
                  </div>
                </div>

                <div className="bg-[#111827] border border-slate-800 rounded-lg p-4">
                  <div className="text-xs text-slate-400">عمق ناخالص آبیاری و حجم در هکتار</div>
                  <div className="mt-1.5 text-2xl font-mono font-bold text-slate-100 tabular-nums">
                    {irrigationPlan.grossIrrigationDepthMm}
                    <span className="text-xs font-normal text-slate-400 mr-1">mm</span>
                    <span className="text-slate-600 mx-1.5">·</span>
                    <span className="text-emerald-400">{irrigationPlan.volumePerHaM3}</span>
                    <span className="text-xs font-normal text-slate-400 mr-1">m³/ha</span>
                  </div>
                  <div className="mt-1 text-[11px] text-slate-400 font-mono">
                    نیاز خالص: {irrigationPlan.netIrrigationDepthMm} mm · آبشویی شوری: {irrigationPlan.leachingFractionPct}%
                  </div>
                </div>

                <div className="bg-[#111827] border border-slate-800 rounded-lg p-4">
                  <div className="text-xs text-slate-400">حجم کل آب و ساعت کارکرد پمپ</div>
                  <div className="mt-1.5 text-2xl font-mono font-bold text-emerald-400 tabular-nums">
                    {irrigationPlan.totalFarmVolumeM3.toLocaleString()}
                    <span className="text-xs font-normal text-slate-400 mr-1">m³</span>
                  </div>
                  <div className="mt-1 text-[11px] text-slate-300 font-mono">
                    ساعت کارکرد پمپ ({pumpFlowLps} L/s): <strong>{irrigationPlan.pumpOperationHours} ساعت</strong>
                  </div>
                </div>

                <div className="bg-[#111827] border border-slate-800 rounded-lg p-4">
                  <div className="text-xs text-slate-400">رطوبت حجمی فعلی ناحیه ریشه (VWC)</div>
                  <div className="mt-1.5 text-2xl font-mono font-bold text-sky-400 tabular-nums">
                    {irrigationPlan.currentVwcPct}%
                  </div>
                  <div className="mt-1 text-[11px] text-slate-400 font-mono">
                    ظرفیت زراعی (FC): {irrigationPlan.fieldCapacityPct}% · حد تنش: {irrigationPlan.criticalThresholdPct}%
                  </div>
                </div>
              </div>

              {/* 7-Day Soil Moisture Depletion & FAO-56 Evapotranspiration Forecast Table */}
              <div className="bg-[#111827] border border-slate-800 rounded-lg p-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-800">
                  <div>
                    <h2 className="text-base font-semibold text-slate-100">
                      جدول پیش‌بینی ۷ روزه بیلان رطوبتی خاک و تبخیر-تعرق (FAO-56 Penman-Monteith)
                    </h2>
                    <p className="text-xs text-slate-400 mt-0.5">
                      ترکیب داده رطوبت سطحی رادار سنتینل-۱ (VV={selectedParcel.sar.vvDb}dB) و شاخص NDMI سنتینل-۲ با پیش‌بینی هواشناسی مختصات <span className="font-mono text-slate-300" dir="ltr">{selectedRegion.lat}°N, {selectedRegion.lon}°E</span>
                    </p>
                  </div>
                  <div className="text-xs font-mono text-slate-400 shrink-0">
                    {meteoLoading
                      ? 'در حال دریافت داده هواشناسی...'
                      : irrigationPlan.isLiveMeteo
                      ? '● متصل به ایستگاه زنده Open-Meteo'
                      : '● مدل اقلیمی کالیبره‌شده ایستگاه سینوپتیک'}
                  </div>
                </div>

                <div className="overflow-x-auto mt-4">
                  <table className="w-full text-right border-collapse">
                    <thead>
                      <tr className="border-b border-slate-800 text-xs text-slate-400 bg-[#0F172A]">
                        <th className="py-3 px-3 font-medium">روز و تاریخ</th>
                        <th className="py-3 px-3 font-medium text-left">دمای کمینه / بیشینه</th>
                        <th className="py-3 px-3 font-medium text-left">بارش پیش‌بینی‌شده</th>
                        <th className="py-3 px-3 font-medium text-left">تبخیر مرجع (ET₀)</th>
                        <th className="py-3 px-3 font-medium text-left">نیاز آبی گیاه (ETc)</th>
                        <th className="py-3 px-3 font-medium text-left">رطوبت خاک (VWC)</th>
                        <th className="py-3 px-3 font-medium">وضعیت تنش آبی در ریشه</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/80 text-xs font-mono tabular-nums">
                      {irrigationPlan.forecastDays.map((day, idx) => (
                        <tr
                          key={day.dateIso}
                          className={`transition-colors ${
                            idx === irrigationPlan.daysUntilStress
                              ? 'bg-cyan-950/30 hover:bg-cyan-950/50'
                              : 'hover:bg-slate-800/30'
                          }`}
                        >
                          <td className="py-3 px-3 font-sans font-medium text-slate-200">
                            {day.persianDay}
                          </td>
                          <td className="py-3 px-3 text-left text-slate-300" dir="ltr">
                            {day.tempMinC}°C / <span className="text-amber-300">{day.tempMaxC}°C</span>
                          </td>
                          <td className="py-3 px-3 text-left text-cyan-400" dir="ltr">
                            {day.precipitationMm} mm
                          </td>
                          <td className="py-3 px-3 text-left text-slate-300" dir="ltr">
                            {day.et0Mm} mm/d
                          </td>
                          <td className="py-3 px-3 text-left text-emerald-400 font-semibold" dir="ltr">
                            {day.etcMm} mm/d
                          </td>
                          <td className="py-3 px-3 text-left">
                            <div className="flex items-center justify-end gap-2" dir="ltr">
                              <span
                                className={
                                  day.needsIrrigation ? 'text-rose-400 font-bold' : 'text-sky-300'
                                }
                              >
                                {day.projectedMoisturePct}%
                              </span>
                              <div className="w-16 h-2 bg-[#0B0F17] rounded-xs overflow-hidden border border-slate-800">
                                <div
                                  className={`h-full ${
                                    day.needsIrrigation ? 'bg-rose-500' : 'bg-cyan-500'
                                  }`}
                                  style={{
                                    width: `${Math.min(
                                      100,
                                      Math.round(
                                        (day.projectedMoisturePct / irrigationPlan.fieldCapacityPct) * 100
                                      )
                                    )}%`,
                                  }}
                                />
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-3 font-sans">
                            {idx === irrigationPlan.daysUntilStress ? (
                              <span className="text-cyan-300 font-semibold">
                                ● زمان بهینه آغاز آبیاری (تخلیه مجاز RAW)
                              </span>
                            ) : day.needsIrrigation ? (
                              <span className="text-rose-400">
                                ✖ عبور از آستانه تنش ({day.stressThresholdPct}%)
                              </span>
                            ) : (
                              <span className="text-emerald-400">● رطوبت کافی در ناحیه ریشه</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: CUSTOM IMAGE PROCESSING LAB */}
          {activeTab === 'custom-lab' && <CustomImageLab />}
        </main>
      </div>

      {/* Quiet Editorial Footer (No fake telemetry tickers) */}
      <footer className="mt-auto border-t border-slate-800/80 bg-[#0B0F17] px-6 py-4 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2">
        <div>
          آذرکشت سنتینل — سامانه تصمیم‌یار پایش ماهواره‌ای خاک، کود و آبیاری ویژه کشاورزان آذربایجان شرقی و غرب ایران
        </div>
        <div className="flex items-center gap-3 font-mono text-[11px]" dir="ltr">
          <span>Sentinel-2 L2A (10m)</span>
          <span>·</span>
          <span>Sentinel-1 C-SAR</span>
          <span>·</span>
          <span>FAO-56 Penman-Monteith</span>
        </div>
      </footer>
    </div>
  );
}
