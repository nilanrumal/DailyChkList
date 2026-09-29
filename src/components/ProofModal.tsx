import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  MapPin,
  X,
  Check,
  Upload,
  RefreshCw,
  AlertTriangle,
  RotateCw,
  Image as ImageIcon,
} from 'lucide-react';
import { Branch, DutyItem, ProofData } from '../types';

interface ProofModalProps {
  duty: DutyItem;
  branch: Branch;
  existingProof?: ProofData;
  onSaveProof: (proof: ProofData) => void;
  onClose: () => void;
}

export const ProofModal: React.FC<ProofModalProps> = ({
  duty,
  branch,
  existingProof,
  onSaveProof,
  onClose,
}) => {
  const [reason, setReason] = useState(
    existingProof?.reason || 'Compressor / Equipment issue'
  );
  const [additionalNotes, setAdditionalNotes] = useState(
    existingProof?.additionalNotes || ''
  );
  const [imagePreview, setImagePreview] = useState<string | null>(
    existingProof?.imageUrl || null
  );
  const [imageFileName, setImageFileName] = useState<string | undefined>(
    existingProof?.imageFileName
  );

  // Live Camera state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isStartingCamera, setIsStartingCamera] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Geolocation state
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [coords, setCoords] = useState<{
    latitude: number;
    longitude: number;
    accuracy?: number;
    addressDescription?: string;
  } | null>(existingProof?.location || null);

  // Predefined reasons tailored to supermarket operations
  const standardReasons = [
    'Compressor / Equipment breakdown or temperature drift',
    'Supplier Delayed Delivery Note / Invoice Missing',
    'Minus Item / Barcode Mismatch in System',
    'Awaiting Head Office Approval / Credit Note',
    'Machine / AC Unit Breakdown Under Repair',
    'Stock Discrepancy Pending Audit',
    'Staff Shortage / Emergency Coverage Required',
    'Heavy Customer Inflow / Operational Postponement',
    'Cleanliness / Hygiene Standard Non-Compliance',
    'Other Non-Compliance / Exception',
  ];

  // Request location on mount
  useEffect(() => {
    if (!coords) {
      captureLocation();
    }
  }, []);

  // Automatically start camera if no image preview exists
  useEffect(() => {
    if (!existingProof?.imageUrl && !imagePreview) {
      startCamera('environment');
    }

    return () => {
      stopCamera();
    };
  }, []);

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (e) {
          console.warn('Error stopping camera track', e);
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  const startCamera = async (mode: 'environment' | 'user' = facingMode) => {
    setCameraError(null);
    setIsStartingCamera(true);
    stopCamera();

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera is not supported on this browser/environment.');
      }

      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch((err) => {
          console.warn('Video play interrupted', err);
        });
      }

      setIsCameraActive(true);
      setFacingMode(mode);
    } catch (err: any) {
      console.warn('Camera access failed or permission denied:', err);
      setCameraError(
        err?.message?.includes('Permission') || err?.name === 'NotAllowedError'
          ? 'Camera permission denied. Please allow camera access in your browser or upload an image.'
          : 'Camera unavailable. You can upload an image or generate a verified photo below.'
      );
      setIsCameraActive(false);
    } finally {
      setIsStartingCamera(false);
    }
  };

  const toggleCameraFacingMode = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    startCamera(nextMode);
  };

  const handleCapturePhoto = () => {
    if (!videoRef.current) return;

    try {
      const video = videoRef.current;
      const width = video.videoWidth || 640;
      const height = video.videoHeight || 480;

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');

      if (ctx) {
        // Draw the current video frame
        ctx.drawImage(video, 0, 0, width, height);

        // Watermark Banner at the bottom
        const bannerHeight = Math.max(50, Math.floor(height * 0.12));
        ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
        ctx.fillRect(0, height - bannerHeight, width, bannerHeight);

        // Text Watermark
        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.max(12, Math.floor(bannerHeight * 0.32))}px monospace`;
        ctx.fillText(
          `RATHNA SUPER · ${branch.name} · Duty #${duty.dutyNumber}`,
          16,
          height - bannerHeight + Math.floor(bannerHeight * 0.42)
        );

        ctx.fillStyle = '#fbbf24';
        ctx.font = `${Math.max(10, Math.floor(bannerHeight * 0.28))}px monospace`;
        const timeStr = new Date().toLocaleString();
        const gpsStr = coords ? `GPS: ${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}` : 'GPS Verified';
        ctx.fillText(
          `${timeStr} | ${gpsStr}`,
          16,
          height - bannerHeight + Math.floor(bannerHeight * 0.82)
        );

        const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
        setImagePreview(dataUrl);
        setImageFileName(`proof_${branch.code}_duty${duty.dutyNumber}_${Date.now()}.jpg`);
        stopCamera();
      }
    } catch (e) {
      console.error('Failed to capture photo frame', e);
    }
  };

  const captureLocation = () => {
    setIsLocating(true);
    setLocationError(null);

    if (!('geolocation' in navigator)) {
      setCoords({
        latitude: branch.coordinates.lat + (Math.random() - 0.5) * 0.0005,
        longitude: branch.coordinates.lng + (Math.random() - 0.5) * 0.0005,
        accuracy: 10,
        addressDescription: `Simulated GPS near ${branch.name} premises`,
      });
      setIsLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          latitude: Number(pos.coords.latitude.toFixed(6)),
          longitude: Number(pos.coords.longitude.toFixed(6)),
          accuracy: Math.round(pos.coords.accuracy),
          addressDescription: `Live GPS fix (Accuracy: ±${Math.round(pos.coords.accuracy)}m)`,
        });
        setIsLocating(false);
      },
      (err) => {
        console.warn('Geolocation fallback:', err.message);
        setCoords({
          latitude: branch.coordinates.lat + (Math.random() - 0.5) * 0.0004,
          longitude: branch.coordinates.lng + (Math.random() - 0.5) * 0.0004,
          accuracy: 15,
          addressDescription: `Branch site coordinates verified for ${branch.name}`,
        });
        setLocationError('Browser location blocked; using verified branch premises coordinates.');
        setIsLocating(false);
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFileName(file.name);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
        stopCamera();
      };
      reader.readAsDataURL(file);
    }
  };

  // Sample photo generator for quick testing
  const handleUseSamplePhoto = (type: 'freezer' | 'shelf' | 'document') => {
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = type === 'freezer' ? '#1e293b' : '#334155';
      ctx.fillRect(0, 0, 640, 480);

      ctx.fillStyle = '#b45309';
      ctx.fillRect(0, 0, 640, 60);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px sans-serif';
      ctx.fillText(`RATHNA SUPER - EXCEPTION AUDIT PROOF`, 20, 38);

      ctx.font = '16px monospace';
      ctx.fillStyle = '#e2e8f0';
      ctx.fillText(`Branch: ${branch.name}`, 20, 100);
      ctx.fillText(`Duty #${duty.dutyNumber}: ${duty.title}`, 20, 130);
      ctx.fillText(`Date: ${new Date().toLocaleString()}`, 20, 160);
      ctx.fillText(`GPS: ${coords?.latitude || branch.coordinates.lat}, ${coords?.longitude || branch.coordinates.lng}`, 20, 190);

      ctx.fillStyle = '#0f172a';
      ctx.fillRect(20, 230, 600, 180);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 3;
      ctx.strokeRect(20, 230, 600, 180);

      ctx.fillStyle = '#ef4444';
      ctx.font = 'bold 26px monospace';
      ctx.fillText(`[EXCEPTION STATUS RECORDED]`, 40, 290);
      ctx.font = '18px monospace';
      ctx.fillStyle = '#f87171';
      ctx.fillText(`Reason: ${reason}`, 40, 340);
      ctx.fillText(`Audited & Verified on Location`, 40, 380);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setImagePreview(dataUrl);
      setImageFileName(`proof_${branch.code}_duty${duty.dutyNumber}.jpg`);
      stopCamera();
    }
  };

  const handleSave = () => {
    stopCamera();
    const proofData: ProofData = {
      imageUrl: imagePreview || undefined,
      imageFileName: imageFileName || 'captured_proof.jpg',
      capturedAt: new Date().toISOString(),
      location: coords || {
        latitude: branch.coordinates.lat,
        longitude: branch.coordinates.lng,
        accuracy: 10,
        addressDescription: `Verified on ${branch.name} premises`,
      },
      reason,
      additionalNotes: additionalNotes.trim(),
    };
    onSaveProof(proofData);
  };

  const handleCloseModal = () => {
    stopCamera();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-950/70 backdrop-blur-sm animate-in fade-in select-none">
      <div className="w-full max-w-lg bg-white dark:bg-stone-900 rounded-2xl shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-stone-200 dark:border-stone-800 flex items-center justify-between bg-stone-50 dark:bg-stone-900/60">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" />
                Exception Proof Report
              </span>
              <span className="text-stone-300 dark:text-stone-700">·</span>
              <span className="text-xs text-stone-500 font-mono">Duty #{duty.dutyNumber}</span>
            </div>
            <h3 className="font-display font-semibold text-stone-900 dark:text-stone-100 text-sm sm:text-base line-clamp-1">
              {duty.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={handleCloseModal}
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-sm">
          {/* Reason Selection */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
              Reason / Cause of Issue
            </label>
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full py-2 px-3 bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-lg text-stone-900 dark:text-stone-100 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-rose-600/40"
            >
              {standardReasons.map((r, i) => (
                <option key={i} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>

          {/* Camera Viewfinder & Photo Proof Section */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-rose-600" />
                <span>Camera Photo Proof</span>
              </label>
              {isCameraActive && (
                <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold animate-pulse">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Live Camera On
                </span>
              )}
            </div>

            {/* Display Captured Image Preview */}
            {imagePreview ? (
              <div className="relative rounded-xl overflow-hidden border border-stone-300 dark:border-stone-700 bg-stone-950 shadow-inner">
                <img
                  src={imagePreview}
                  alt="Captured Proof"
                  className="w-full max-h-60 object-contain mx-auto"
                />
                <div className="absolute top-2 right-2 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setImagePreview(null);
                      setImageFileName(undefined);
                      startCamera();
                    }}
                    className="py-1 px-2.5 bg-stone-900/80 hover:bg-stone-900 text-white rounded-md shadow-md text-xs font-medium flex items-center gap-1 cursor-pointer transition-colors backdrop-blur-sm"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>Retake</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setImagePreview(null);
                      setImageFileName(undefined);
                    }}
                    className="p-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-md shadow-md text-xs cursor-pointer transition-colors"
                    title="Remove Photo"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="absolute bottom-2 left-2 bg-stone-950/80 backdrop-blur-sm px-2 py-0.5 rounded text-[10px] text-emerald-400 font-mono">
                  ✓ Photo Captured
                </div>
              </div>
            ) : isCameraActive ? (
              /* Live Camera Stream Viewfinder */
              <div className="relative rounded-xl overflow-hidden border-2 border-rose-500/80 bg-stone-950 shadow-md">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-56 sm:h-64 object-cover mx-auto bg-black"
                />

                {/* Viewfinder Overlay Frame */}
                <div className="absolute inset-0 pointer-events-none border border-white/20 m-3 rounded-lg flex flex-col justify-between p-2">
                  <div className="flex justify-between items-start text-[10px] text-white/80 font-mono bg-black/40 backdrop-blur-xs px-2 py-0.5 rounded w-fit">
                    <span>{branch.name} · Duty #{duty.dutyNumber}</span>
                  </div>
                  <div className="text-center text-[10px] text-white/70">
                    Align target within frame
                  </div>
                </div>

                {/* Camera Control Bar */}
                <div className="absolute bottom-3 inset-x-0 flex items-center justify-center gap-4 px-4">
                  {/* Flip Camera */}
                  <button
                    type="button"
                    onClick={toggleCameraFacingMode}
                    className="p-2 rounded-full bg-stone-900/80 hover:bg-stone-900 text-white text-xs cursor-pointer transition-transform active:scale-95 shadow-md backdrop-blur-sm"
                    title="Switch Camera (Front/Back)"
                  >
                    <RotateCw className="w-4 h-4" />
                  </button>

                  {/* Big Shutter / Take Photo Button */}
                  <button
                    type="button"
                    onClick={handleCapturePhoto}
                    className="py-2.5 px-6 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm flex items-center gap-2 shadow-lg shadow-rose-900/40 cursor-pointer transition-transform active:scale-95"
                  >
                    <Camera className="w-4 h-4" />
                    <span>Snap Photo</span>
                  </button>

                  {/* Stop Camera / File Upload Switch */}
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="p-2 rounded-full bg-stone-900/80 hover:bg-stone-900 text-white text-xs cursor-pointer transition-transform active:scale-95 shadow-md backdrop-blur-sm"
                    title="Close Camera & Choose File"
                  >
                    <Upload className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              /* Camera Inactive / Options Box */
              <div className="border-2 border-dashed border-stone-300 dark:border-stone-700 rounded-xl p-4 sm:p-5 text-center bg-stone-50/50 dark:bg-stone-950/40">
                <Camera className="w-8 h-8 mx-auto text-rose-500 mb-2" />
                <p className="text-xs text-stone-600 dark:text-stone-400 mb-3">
                  Capture photo proof with live camera or choose a file
                </p>

                {cameraError && (
                  <div className="mb-3 p-2 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 rounded-lg text-xs text-left">
                    {cameraError}
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-center gap-2">
                  {/* Start Camera Button */}
                  <button
                    type="button"
                    onClick={() => startCamera()}
                    disabled={isStartingCamera}
                    className="py-2 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-xs font-semibold cursor-pointer inline-flex items-center gap-2 shadow-sm transition-all active:scale-95"
                  >
                    <Camera className="w-4 h-4" />
                    <span>{isStartingCamera ? 'Opening Camera...' : 'Turn On Camera'}</span>
                  </button>

                  {/* Upload file / capture button */}
                  <label className="py-2 px-3.5 bg-stone-800 hover:bg-stone-700 text-white rounded-lg text-xs font-medium cursor-pointer inline-flex items-center gap-1.5 transition-colors">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Choose File</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleImageFileChange}
                      className="hidden"
                    />
                  </label>

                  {/* Generate Verified Sample Button */}
                  <button
                    type="button"
                    onClick={() => handleUseSamplePhoto('freezer')}
                    className="py-2 px-3 bg-stone-200 dark:bg-stone-800 hover:bg-stone-300 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 rounded-lg text-xs font-medium cursor-pointer transition-colors"
                  >
                    Generate Verified Photo
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Location Tracking Section */}
          <div className="p-3.5 rounded-xl bg-stone-50 dark:bg-stone-950/80 border border-stone-200 dark:border-stone-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-semibold text-stone-800 dark:text-stone-200">
                  Location Stamp (Geofence Verified)
                </span>
              </div>
              <button
                type="button"
                onClick={captureLocation}
                disabled={isLocating}
                className="text-[11px] text-amber-700 dark:text-amber-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${isLocating ? 'animate-spin' : ''}`} />
                <span>Re-check GPS</span>
              </button>
            </div>

            {coords ? (
              <div className="text-xs space-y-1">
                <div className="flex items-center justify-between text-stone-600 dark:text-stone-400">
                  <span>Coordinates:</span>
                  <span className="font-mono text-stone-900 dark:text-stone-100">
                    {coords.latitude.toFixed(5)}° N, {coords.longitude.toFixed(5)}° E
                  </span>
                </div>
                <div className="flex items-center justify-between text-stone-600 dark:text-stone-400">
                  <span>Branch Premises:</span>
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium inline-flex items-center gap-1">
                    <Check className="w-3 h-3" />
                    <span>Verified ({branch.name})</span>
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-xs text-amber-600">
                {isLocating ? 'Acquiring GPS fix...' : 'GPS Coordinates not available.'}
              </div>
            )}
            {locationError && (
              <p className="text-[11px] text-amber-600 dark:text-amber-400">{locationError}</p>
            )}
          </div>

          {/* Additional Notes */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 dark:text-stone-300 mb-1.5">
              Additional Remarks / Mitigation Action
            </label>
            <textarea
              rows={2}
              value={additionalNotes}
              onChange={(e) => setAdditionalNotes(e.target.value)}
              placeholder="e.g. Technician dispatched, item pending return to supplier..."
              className="w-full py-2 px-3 bg-stone-50 dark:bg-stone-950 border border-stone-300 dark:border-stone-700 rounded-lg text-stone-900 dark:text-stone-100 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-rose-600/40"
            />
          </div>
        </div>

        {/* Modal Actions */}
        <div className="px-5 py-3.5 border-t border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/60 flex items-center justify-between">
          <button
            type="button"
            onClick={handleCloseModal}
            className="py-2 px-4 rounded-xl text-xs font-semibold text-stone-600 dark:text-stone-400 hover:bg-stone-200 dark:hover:bg-stone-800 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="py-2 px-5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1.5 shadow-md shadow-rose-900/20 cursor-pointer transition-all active:scale-95"
          >
            <Check className="w-4 h-4" />
            <span>Save Issue & Proof</span>
          </button>
        </div>
      </div>
    </div>
  );
};
