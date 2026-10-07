import React, { useEffect, useRef, useState } from 'react';
import { ParcelZone, RegionDataset } from '../data/regionsData';
import { calculateSpectralIndices } from '../utils/spectralEngine';
import { Layers, Crosshair, Eye, Sliders, Compass, CheckCircle2 } from 'lucide-react';

export type SpectralLayerType =
  | 'true-color'
  | 'ndvi'
  | 'ndmi'
  | 'bsi'
  | 'salinity'
  | 'dl-unet';

interface SatelliteCanvasMapProps {
  region: RegionDataset;
  selectedParcel: ParcelZone;
  onSelectParcel: (parcel: ParcelZone) => void;
  activeLayer: SpectralLayerType;
  onChangeLayer: (layer: SpectralLayerType) => void;
}

export const LAYER_DEFINITIONS: {
  id: SpectralLayerType;
  label: string;
  formula: string;
  bandsUsed: string;
  description: string;
  legendMin: string;
  legendMid: string;
  legendMax: string;
  gradientClass: string;
}[] = [
  {
    id: 'ndvi',
    label: 'پوشش گیاهی (NDVI)',
    formula: '(B8 - B4) / (B8 + B4)',
    bandsUsed: 'NIR (842nm) · Red (665nm)',
    description: 'سنجش تراکم کلروفیل، شاخص سطح برگ (LAI) و زیست‌توده محصول',
    legendMin: '۰.۱۰ (خاک لخت)',
    legendMid: '۰.۴۵ (پوشش متوسط)',
    legendMax: '۰.۸۵ (تراکم عالی)',
    gradientClass: 'from-amber-700 via-yellow-400 to-emerald-500',
  },
  {
    id: 'ndmi',
    label: 'رطوبت خاک و تاج‌پوشش (NDMI)',
    formula: '(B8 - B11) / (B8 + B11)',
    bandsUsed: 'NIR (842nm) · SWIR-1 (1610nm)',
    description: 'تشخیص زودهنگام تنش آبی پیش از پژمردگی ظاهری گیاه با باند فروسرخ موج کوتاه',
    legendMin: '-۰.۱۵ (تنش خشکی)',
    legendMid: '۰.۲۰ (رطوبت متعادل)',
    legendMax: '۰.۵۵ (اشباع رطوبتی)',
    gradientClass: 'from-rose-600 via-amber-300 to-cyan-500',
  },
  {
    id: 'bsi',
    label: 'سلامت و بافت خاک (BSI)',
    formula: '((B11+B4)-(B8+B2)) / ((B11+B4)+(B8+B2))',
    bandsUsed: 'SWIR-1 · Red · NIR · Blue',
    description: 'ارزیابی کربن آلی سطح خاک (SOC)، زبری شخم و فرسایش سطحی',
    legendMin: '-۰.۳۰ (ماده آلی بالا)',
    legendMid: '۰.۰۰ (خاک متوسط)',
    legendMax: '+۰.۳۵ (خاک لخت/فقیر)',
    gradientClass: 'from-emerald-600 via-amber-500 to-stone-400',
  },
  {
    id: 'salinity',
    label: 'شوری و قلیائیت خاک (NDSI)',
    formula: '√(B4 × B11) + SWIR2 · SAR VV',
    bandsUsed: 'Red · SWIR-1 · SWIR-2 (2190nm)',
    description: 'پایش تجمع املاح و هدایت الکتریکی (ECe) ویژه حوضه دریاچه ارومیه و دشت تبریز',
    legendMin: '۱.۰ dS/m (غیرشور)',
    legendMid: '۲.۵ dS/m (لب‌شور)',
    legendMax: '>۴.۵ dS/m (شور بحرانی)',
    gradientClass: 'from-emerald-500 via-amber-400 to-fuchsia-600',
  },
  {
    id: 'dl-unet',
    label: 'پهنه‌بندی یادگیری عمیق (3D-ResUNet)',
    formula: 'CNN Spatial-Spectral Segmentation',
    bandsUsed: '10-Band S2 + S1VV/VH Fusion',
    description: 'افراز خودکار قطعات زراعی و کلاسبندی مناطق نیازمند کوددهی متغیر (VRA)',
    legendMin: 'پهنه C (نیاز فوری کود/آب)',
    legendMid: 'پهنه B (نیاز متوسط)',
    legendMax: 'پهنه A (رشد بهینه)',
    gradientClass: 'from-rose-500 via-amber-400 to-emerald-500',
  },
  {
    id: 'true-color',
    label: 'تصویر اپتیکی طبیعی (RGB)',
    formula: 'True Color Composite (L2A BOA)',
    bandsUsed: 'B4 (665nm) · B3 (560nm) · B2 (490nm)',
    description: 'تصویر تصحیح‌شده اتمسفری سنتینل-۲ با تفکیک مکانی ۱۰ متر',
    legendMin: 'بازتاب کم',
    legendMid: 'بازتاب متوسط',
    legendMax: 'بازتاب بالا',
    gradientClass: 'from-slate-800 via-slate-500 to-slate-200',
  },
];

function pointInPolygon(point: [number, number], vs: [number, number][]): boolean {
  const x = point[0], y = point[1];
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i][0], yi = vs[i][1];
    const xj = vs[j][0], yj = vs[j][1];
    const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi + 0.00001) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

export const SatelliteCanvasMap: React.FC<SatelliteCanvasMapProps> = ({
  region,
  selectedParcel,
  onSelectParcel,
  activeLayer,
  onChangeLayer,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [loadedImage, setLoadedImage] = useState<HTMLImageElement | null>(null);
  const [overlayOpacity, setOverlayOpacity] = useState<number>(0.72);
  const [showGrid, setShowGrid] = useState<boolean>(true);
  const [hoverProbe, setHoverProbe] = useState<{
    xPct: number;
    yPct: number;
    lat: number;
    lon: number;
    ndvi: number;
    ndmi: number;
    ec: number;
    parcelName: string | null;
  } | null>(null);

  // Load region satellite image
  useEffect(() => {
    let isMounted = true;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = region.imageAsset;
    img.onload = () => {
      if (isMounted) setLoadedImage(img);
    };
    img.onerror = () => {
      if (isMounted) setLoadedImage(null);
    };
    return () => {
      isMounted = false;
    };
  }, [region.imageAsset]);

  // Render satellite scene + spectral pixel overlay + parcel polygons
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);

    // 1. Draw base satellite orthophoto or procedural multispectral terrain fallback
    if (loadedImage) {
      ctx.drawImage(loadedImage, 0, 0, width, height);
    } else {
      const grad = ctx.createLinearGradient(0, 0, width, height);
      grad.addColorStop(0, '#0f291e');
      grad.addColorStop(0.5, '#1e3a2f');
      grad.addColorStop(1, '#27231a');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
    }

    // 2. Apply scientific spectral heatmap overlay inside each parcel polygon (and subtle full-scene spectral tint)
    if (activeLayer !== 'true-color') {
      // Subtle scene-wide spectral atmosphere
      ctx.save();
      ctx.fillStyle = 'rgba(11, 15, 23, 0.28)';
      ctx.fillRect(0, 0, width, height);
      ctx.restore();

      region.parcels.forEach((parcel) => {
        const indices = calculateSpectralIndices(parcel);
        ctx.save();
        ctx.beginPath();
        parcel.polygon.forEach(([px, py], idx) => {
          const cx = (px / 100) * width;
          const cy = (py / 100) * height;
          if (idx === 0) ctx.moveTo(cx, cy);
          else ctx.lineTo(cx, cy);
        });
        ctx.closePath();
        ctx.clip();

        // Draw high-resolution grid cells inside the clipped polygon to simulate 10m Sentinel-2 pixels
        const cellSize = 14;
        const polyBoundsX = parcel.polygon.map((p) => (p[0] / 100) * width);
        const polyBoundsY = parcel.polygon.map((p) => (p[1] / 100) * height);
        const minX = Math.max(0, Math.floor(Math.min(...polyBoundsX) / cellSize) * cellSize);
        const maxX = Math.min(width, Math.ceil(Math.max(...polyBoundsX) / cellSize) * cellSize);
        const minY = Math.max(0, Math.floor(Math.min(...polyBoundsY) / cellSize) * cellSize);
        const maxY = Math.min(height, Math.ceil(Math.max(...polyBoundsY) / cellSize) * cellSize);

        for (let gx = minX; gx < maxX; gx += cellSize) {
          for (let gy = minY; gy < maxY; gy += cellSize) {
            // Spatial micro-variation within parcel (deterministic wave based on pixel coordinates)
            const spatialWave =
              Math.sin(gx * 0.045 + gy * 0.03) * 0.08 +
              Math.cos(gx * 0.02 - gy * 0.05) * 0.05;

            let r = 16, g = 185, b = 129;

            if (activeLayer === 'ndvi') {
              const localNdvi = Math.min(0.9, Math.max(0.1, indices.ndvi + spatialWave));
              if (localNdvi > 0.65) {
                r = 16; g = 185; b = 105; // Deep healthy chlorophyll emerald
              } else if (localNdvi > 0.48) {
                r = 132; g = 204; b = 22; // Lime moderate canopy
              } else if (localNdvi > 0.32) {
                r = 234; g = 179; b = 8; // Amber sparse vegetation
              } else {
                r = 180; g = 83; b = 9; // Bare soil ochre
              }
            } else if (activeLayer === 'ndmi') {
              const localNdmi = Math.min(0.55, Math.max(-0.15, indices.ndmi + spatialWave * 0.8));
              if (localNdmi > 0.28) {
                r = 6; g = 182; b = 212; // Cyan well-watered
              } else if (localNdmi > 0.16) {
                r = 56; g = 189; b = 248; // Light sky moisture
              } else if (localNdmi > 0.05) {
                r = 251; g = 191; b = 36; // Amber mild moisture deficit
              } else {
                r = 225; g = 29; b = 72; // Crimson severe water stress
              }
            } else if (activeLayer === 'bsi') {
              const localSoc = parcel.soil.organicCarbonPct + spatialWave * 2.2;
              if (localSoc > 1.45) {
                r = 16; g = 185; b = 129; // High SOC fertile soil
              } else if (localSoc > 1.0) {
                r = 245; g = 158; b = 11; // Moderate organic matter
              } else {
                r = 168; g = 162; b = 158; // High bare soil / low organic carbon
              }
            } else if (activeLayer === 'salinity') {
              const localEc = parcel.soil.ecDsM + spatialWave * 3.5;
              if (localEc > 3.5) {
                r = 192; g = 38; b = 211; // Fuchsia critical salinity
              } else if (localEc > 2.2) {
                r = 245; g = 158; b = 11; // Amber moderate salinity
              } else {
                r = 16; g = 185; b = 129; // Nominal low EC
              }
            } else if (activeLayer === 'dl-unet') {
              // Deep learning VRA segmentation zones (Zone A, B, C)
              const score = indices.overallHealthScore + spatialWave * 45;
              if (score >= 76) {
                r = 16; g = 185; b = 129; // Zone A: Optimal
              } else if (score >= 62) {
                r = 245; g = 158; b = 11; // Zone B: Variable rate medium boost
              } else {
                r = 239; g = 68; b = 68; // Zone C: High priority stress patch
              }
            }

            ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${overlayOpacity})`;
            ctx.fillRect(gx, gy, cellSize - 1, cellSize - 1);
          }
        }
        ctx.restore();
      });
    }

    // 3. Draw UTM / Coordinate Graticule Grid if enabled
    if (showGrid) {
      ctx.save();
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.18)';
      ctx.lineWidth = 1;
      const stepX = width / 6;
      const stepY = height / 4;
      for (let x = stepX; x < width; x += stepX) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = stepY; y < height; y += stepY) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }
      ctx.restore();
    }

    // 4. Draw Parcel Polygons & Labels
    region.parcels.forEach((parcel) => {
      const isSelected = parcel.id === selectedParcel.id;
      const indices = calculateSpectralIndices(parcel);

      ctx.save();
      ctx.beginPath();
      parcel.polygon.forEach(([px, py], idx) => {
        const cx = (px / 100) * width;
        const cy = (py / 100) * height;
        if (idx === 0) ctx.moveTo(cx, cy);
        else ctx.lineTo(cx, cy);
      });
      ctx.closePath();

      ctx.strokeStyle = isSelected ? '#10B981' : 'rgba(248, 250, 252, 0.65)';
      ctx.lineWidth = isSelected ? 3 : 1.5;
      if (!isSelected) {
        ctx.setLineDash([6, 4]);
      }
      ctx.stroke();

      // Draw corner vertices for selected parcel
      if (isSelected) {
        parcel.polygon.forEach(([px, py]) => {
          const cx = (px / 100) * width;
          const cy = (py / 100) * height;
          ctx.fillStyle = '#10B981';
          ctx.fillRect(cx - 4, cy - 4, 8, 8);
          ctx.strokeStyle = '#0B0F17';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(cx - 4, cy - 4, 8, 8);
        });
      }

      // Draw parcel callout HUD tag at center
      const centerX = (parcel.center[0] / 100) * width;
      const centerY = (parcel.center[1] / 100) * height;

      ctx.setLineDash([]);
      ctx.fillStyle = isSelected ? 'rgba(6, 78, 59, 0.92)' : 'rgba(15, 23, 42, 0.86)';
      const boxW = 136;
      const boxH = 44;
      ctx.fillRect(centerX - boxW / 2, centerY - boxH / 2, boxW, boxH);
      ctx.strokeStyle = isSelected ? '#34D399' : '#475569';
      ctx.lineWidth = 1;
      ctx.strokeRect(centerX - boxW / 2, centerY - boxH / 2, boxW, boxH);

      ctx.fillStyle = '#F8FAFC';
      ctx.font = '600 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(parcel.code, centerX, centerY - 5);

      ctx.fillStyle = isSelected ? '#6EE7B7' : '#CBD5E1';
      ctx.font = '500 10px "JetBrains Mono", monospace';
      ctx.fillText(`NDVI ${indices.ndvi.toFixed(2)} · ${parcel.areaHa} ha`, centerX, centerY + 12);

      ctx.restore();
    });
  }, [loadedImage, region, selectedParcel, activeLayer, overlayOpacity, showGrid]);

  // Handle mouse move for live pixel inspection probe
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;

    const lat = Number((region.lat + (50 - yPct) * 0.00045).toFixed(5));
    const lon = Number((region.lon + (xPct - 50) * 0.00055).toFixed(5));

    const hitParcel = region.parcels.find((p) => pointInPolygon([xPct, yPct], p.polygon));
    const baseIndices = hitParcel
      ? calculateSpectralIndices(hitParcel)
      : calculateSpectralIndices(selectedParcel);

    const wave = Math.sin(xPct * 0.3 + yPct * 0.2) * 0.04;
    setHoverProbe({
      xPct,
      yPct,
      lat,
      lon,
      ndvi: Number(Math.min(0.92, Math.max(0.12, baseIndices.ndvi + wave)).toFixed(3)),
      ndmi: Number(Math.min(0.55, Math.max(-0.12, baseIndices.ndmi + wave * 0.7)).toFixed(3)),
      ec: Number(
        Math.max(0.8, (hitParcel ? hitParcel.soil.ecDsM : selectedParcel.soil.ecDsM) + wave * 4).toFixed(2)
      ),
      parcelName: hitParcel ? hitParcel.name : null,
    });
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;

    const hitParcel = region.parcels.find((p) => pointInPolygon([xPct, yPct], p.polygon));
    if (hitParcel) {
      onSelectParcel(hitParcel);
    }
  };

  const currentLayerInfo = LAYER_DEFINITIONS.find((l) => l.id === activeLayer) || LAYER_DEFINITIONS[0];

  return (
    <div className="bg-[#111827] border border-slate-800 rounded-lg overflow-hidden">
      {/* Top Spectral Layer Switcher Bar */}
      <div className="p-3 bg-[#0F172A] border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-slate-400 flex items-center gap-1.5 ml-2">
            <Layers className="w-3.5 h-3.5 text-emerald-400" />
            لایه طیفی ماهواره:
          </span>
          <div className="flex items-center gap-1 p-1 bg-[#0B0F17] border border-slate-800 rounded-md flex-wrap">
            {LAYER_DEFINITIONS.map((layer) => (
              <button
                key={layer.id}
                onClick={() => onChangeLayer(layer.id)}
                className={`px-2.5 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                  activeLayer === layer.id
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
              >
                {layer.label}
              </button>
            ))}
          </div>
        </div>

        {/* Opacity & Grid Controls */}
        <div className="flex items-center gap-4 text-xs text-slate-300">
          <label className="flex items-center gap-2 cursor-pointer">
            <Sliders className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-slate-400 whitespace-nowrap">شفافیت ماسک:</span>
            <input
              type="range"
              min={0.15}
              max={0.95}
              step={0.05}
              value={overlayOpacity}
              onChange={(e) => setOverlayOpacity(parseFloat(e.target.value))}
              className="w-20 accent-emerald-500 cursor-pointer"
            />
            <span className="font-mono tabular-nums text-emerald-400 w-9">
              {Math.round(overlayOpacity * 100)}%
            </span>
          </label>
          <button
            onClick={() => setShowGrid(!showGrid)}
            className={`px-2.5 py-1 rounded border text-xs transition-colors whitespace-nowrap ${
              showGrid
                ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'
                : 'border-slate-700 bg-slate-800/40 text-slate-400'
            }`}
          >
            شبکه مختصات UTM
          </button>
        </div>
      </div>

      {/* Main Interactive Canvas Stage */}
      <div className="relative bg-[#070A0F] select-none">
        <canvas
          ref={canvasRef}
          width={960}
          height={500}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHoverProbe(null)}
          onClick={handleCanvasClick}
          className="w-full h-[380px] sm:h-[440px] object-cover cursor-crosshair block"
        />

        {/* Top-Right Telemetry HUD Overlay */}
        <div className="absolute top-3 right-3 bg-[#0B0F17]/90 border border-slate-700/80 rounded px-3 py-2 text-xs pointer-events-none max-w-xs">
          <div className="flex items-center gap-2 text-slate-300 font-medium">
            <Compass className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>{region.name}</span>
            <span aria-hidden="true" className="text-slate-600">·</span>
            <span className="font-mono text-[11px] text-emerald-400">{region.sentinelTile.split('·')[0]}</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-400 font-mono tabular-nums" dir="ltr">
            LAT {region.lat.toFixed(4)}°N · LON {region.lon.toFixed(4)}°E · {region.elevationM}m ASL
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            برای انتخاب هر قطعه زراعی، روی چندضلعی آن در نقشه کلیک کنید.
          </div>
        </div>

        {/* Bottom-Left Live Crosshair Pixel Probe HUD */}
        <div
          className="absolute bottom-3 left-3 bg-[#0B0F17]/92 border border-slate-700/90 rounded px-3 py-2 text-xs pointer-events-none"
          dir="ltr"
        >
          <div className="flex items-center gap-2 text-slate-400 mb-1">
            <Crosshair className="w-3.5 h-3.5 text-cyan-400" />
            <span className="font-mono text-[11px] uppercase tracking-wider text-slate-300">
              {hoverProbe
                ? `PIXEL PROBE: ${hoverProbe.lat}°N, ${hoverProbe.lon}°E`
                : `PARCEL CENTER: ${region.lat}°N, ${region.lon}°E`}
            </span>
          </div>
          <div className="flex items-center gap-3 font-mono tabular-nums text-[11px]">
            <span className="text-emerald-400">
              NDVI: {hoverProbe ? hoverProbe.ndvi.toFixed(3) : calculateSpectralIndices(selectedParcel).ndvi.toFixed(3)}
            </span>
            <span className="text-slate-600">·</span>
            <span className="text-cyan-400">
              NDMI: {hoverProbe ? hoverProbe.ndmi.toFixed(3) : calculateSpectralIndices(selectedParcel).ndmi.toFixed(3)}
            </span>
            <span className="text-slate-600">·</span>
            <span className="text-amber-400">
              ECe: {hoverProbe ? hoverProbe.ec.toFixed(2) : selectedParcel.soil.ecDsM.toFixed(2)} dS/m
            </span>
          </div>
        </div>
      </div>

      {/* Bottom Spectral Legend & Parcel Selector Strip */}
      <div className="p-3.5 bg-[#0F172A] border-t border-slate-800 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        {/* Layer Formula & Color Scale Legend */}
        <div className="flex-1 w-full">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-slate-200">{currentLayerInfo.label}</span>
            <span className="text-slate-600">·</span>
            <span className="font-mono text-emerald-400 text-[11px]" dir="ltr">
              {currentLayerInfo.formula}
            </span>
            <span className="text-slate-600">·</span>
            <span className="text-slate-400">{currentLayerInfo.description}</span>
          </div>
          <div className="mt-2 flex items-center gap-3">
            <span className="text-[11px] font-mono text-slate-400 whitespace-nowrap">
              {currentLayerInfo.legendMin}
            </span>
            <div className={`h-2 flex-1 rounded-xs bg-gradient-to-l ${currentLayerInfo.gradientClass}`} />
            <span className="text-[11px] font-mono text-slate-400 whitespace-nowrap">
              {currentLayerInfo.legendMid}
            </span>
            <div className={`h-2 flex-1 rounded-xs bg-gradient-to-l ${currentLayerInfo.gradientClass}`} />
            <span className="text-[11px] font-mono text-slate-300 whitespace-nowrap">
              {currentLayerInfo.legendMax}
            </span>
          </div>
        </div>

        {/* Quick Parcel Switcher Buttons */}
        <div className="flex items-center gap-1.5 flex-wrap shrink-0">
          <span className="text-xs text-slate-400 ml-1">قطعات مزرعه:</span>
          {region.parcels.map((parcel) => {
            const active = parcel.id === selectedParcel.id;
            return (
              <button
                key={parcel.id}
                onClick={() => onSelectParcel(parcel)}
                className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors flex items-center gap-1.5 whitespace-nowrap ${
                  active
                    ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300'
                    : 'bg-[#0B0F17] border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {active && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
                <span>{parcel.code}</span>
                <span className="text-slate-500">·</span>
                <span className="font-mono tabular-nums">{parcel.areaHa} هکتار</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
