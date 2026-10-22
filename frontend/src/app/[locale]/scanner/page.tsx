'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import api from '@/lib/api';
import { cn } from '@/lib/utils';
import {
  VideoCameraIcon,
  StopIcon,
  WifiIcon,
  ExclamationTriangleIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  QrCodeIcon,
} from '@heroicons/react/24/outline';

type ScanResultStatus = 'VALID' | 'ALREADY_USED' | 'WRONG_SHOWTIME' | 'CANCELLED' | 'NOT_FOUND' | 'INVALID';

type ScanResultData = {
  result: ScanResultStatus;
  message?: string;
  seatLabel?: string;
  ticketCode?: string;
};

interface PendingScan {
  qrData: string;
  offlineScanId: string;
  scannedAt: string;
  gate?: string;
}

export default function ScannerPage() {
  const t = useTranslations();

  // Session state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [showtimeId, setShowtimeId] = useState('');
  const [gate, setGate] = useState('A');
  const [sessionInfo, setSessionInfo] = useState<any>(null);

  // Scanning state
  const [scanning, setScanning] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [scanResult, setScanResult] = useState<ScanResultData | null>(null);

  // Offline state
  const [isOnline, setIsOnline] = useState(true);
  const [pendingScans, setPendingScans] = useState<PendingScan[]>([]);
  const [lastSync, setLastSync] = useState<string | null>(null);

  // Override state
  const [overrideNote, setOverrideNote] = useState('');
  const [showOverride, setShowOverride] = useState(false);
  const [lastScanData, setLastScanData] = useState('');

  // Showtimes for selection
  const [showtimes, setShowtimes] = useState<any[]>([]);
  const [loadingShowtimes, setLoadingShowtimes] = useState(true);

  // Camera refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Monitor online/offline
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    setIsOnline(navigator.onLine);

    const stored = localStorage.getItem('pending-scans');
    if (stored) setPendingScans(JSON.parse(stored));
    const ls = localStorage.getItem('last-sync');
    if (ls) setLastSync(ls);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Cleanup camera on unmount
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
      }
    };
  }, []);

  // Fetch today's showtimes
  useEffect(() => {
    const fetchShowtimes = async () => {
      try {
        // Get all showtimes via events
        const res = await api.get('/events', { params: { limit: 50 } });
        const events = res.data?.items || res.data || [];
        const allShowtimes: any[] = [];
        for (const event of events) {
          try {
            const stRes = await api.get(`/showtimes/event/${event.id}`);
            const sts = Array.isArray(stRes.data) ? stRes.data : (stRes.data?.items || []);
            sts.forEach((st: any) => {
              allShowtimes.push({
                id: st.id,
                label: `${event.title} - ${new Date(st.startsAt).toLocaleDateString()} ${new Date(st.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
                eventTitle: event.title,
                startsAt: st.startsAt,
              });
            });
          } catch {}
        }
        setShowtimes(allShowtimes);
      } catch {
        setShowtimes([]);
      } finally {
        setLoadingShowtimes(false);
      }
    };
    fetchShowtimes();
  }, []);

  // Start scan session
  const startSession = async () => {
    if (!showtimeId || !gate) return;
    try {
      const res = await api.post('/scanner/session/start', {
        showtimeId,
        gate,
        deviceId: `WEB-${navigator.userAgent.slice(0, 20)}`,
      });
      setSessionId(res.data.id);
      setSessionInfo(res.data);
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to start session';
      setScanResult({ result: 'INVALID', message: msg });
    }
  };

  // End scan session
  const endSession = async () => {
    if (!sessionId) return;
    try {
      await api.patch(`/scanner/session/${sessionId}/end`);
    } catch {}
    setSessionId(null);
    setSessionInfo(null);
    stopCamera();
  };

  // Start camera with native API + jsQR decoder
  const startCamera = async () => {
    try {
      // Try rear camera first (mobile), fallback to any camera (desktop)
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: true,
        });
      }
      streamRef.current = stream;
      setScanning(true);

      // Wait for React to show the video element (hidden -> visible)
      await new Promise((resolve) => setTimeout(resolve, 200));

      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        video.muted = true;
        video.playsInline = true;
        video.autoplay = true;
        // Force play
        const playPromise = video.play();
        if (playPromise) {
          playPromise.catch(() => {
            // Retry after user interaction
            setTimeout(() => { try { video.play(); } catch {} }, 500);
          });
        }
      } else {
        console.error('Video element not found after scanning=true');
      }

      // Import jsQR for decoding
      const jsQR = (await import('jsqr')).default;
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      let lastScanned = '';
      let lastScanTime = 0;

      scanIntervalRef.current = setInterval(() => {
        if (!videoRef.current || !ctx || videoRef.current.readyState < 2) return;
        const video = videoRef.current;
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const qrCode = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: 'dontInvert',
        });

        if (qrCode && qrCode.data) {
          const now = Date.now();
          if (qrCode.data !== lastScanned || now - lastScanTime > 4000) {
            lastScanned = qrCode.data;
            lastScanTime = now;
            verifyTicket(qrCode.data);
          }
        }
      }, 250);
    } catch (err: any) {
      setScanResult({ result: 'INVALID', message: `Camera error: ${err?.message || 'Access denied'}. Use manual entry below.` });
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    setScanning(false);
  };

  // Verify ticket (online or offline)
  const verifyTicket = useCallback(
    async (qrData: string) => {
      if (!qrData) return;
      setLastScanData(qrData);
      setShowOverride(false);

      if (!isOnline || !sessionId) {
        // Offline: store for later sync
        const scan: PendingScan = {
          qrData,
          offlineScanId: `offline-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          scannedAt: new Date().toISOString(),
          gate,
        };
        const updated = [...pendingScans, scan];
        setPendingScans(updated);
        localStorage.setItem('pending-scans', JSON.stringify(updated));
        setScanResult({ result: 'VALID', message: 'Stored for sync (offline mode)' });
        return;
      }

      try {
        // Check if QR data is a verify URL (e.g. http://localhost:3001/en/verify/TICKETCODE)
        const verifyMatch = qrData.match(/\/verify\/([A-Za-z0-9]+)$/);
        if (verifyMatch) {
          // URL-based QR — use the public verify endpoint
          const ticketCode = verifyMatch[1];
          const res = await api.get(`/tickets/verify/${ticketCode}`);
          const data = res.data;
          setScanResult({
            result: data.valid ? 'VALID' : (data.status === 'USED' ? 'ALREADY_USED' : data.status === 'CANCELLED' ? 'CANCELLED' : 'INVALID'),
            message: data.valid ? 'Entry approved' : `Ticket status: ${data.status}`,
            seatLabel: data.seatLabel,
            ticketCode: data.ticketCode,
          });
        } else {
          // JSON-based QR — use the scanner/scan endpoint
          const res = await api.post('/scanner/scan', {
            qrData,
            sessionId,
          });
          const data = res.data;
          setScanResult({
            result: data.result,
            message: data.message,
            seatLabel: data.scan?.ticket?.seatLabel,
            ticketCode: data.scan?.ticket?.ticketCode,
          });
        }
      } catch (err: any) {
        const msg = err?.response?.data?.message || 'Scan failed';
        setScanResult({ result: 'INVALID', message: msg });
      }
    },
    [sessionId, gate, isOnline, pendingScans],
  );

  // Manual entry - user pastes the full QR JSON or just the ticket code
  const handleManualVerify = () => {
    const input = manualCode.trim();
    if (!input) return;

    // Try to use as-is (might be JSON QR data or a ticket code)
    let qrData = input;
    if (!input.startsWith('{')) {
      // User entered a ticket code - we can't verify without the signature
      // Try wrapping as a lookup
      qrData = input;
    }
    verifyTicket(qrData);
    setManualCode('');
  };

  // Sync pending offline scans
  const syncPending = async () => {
    if (pendingScans.length === 0 || !sessionId) return;
    try {
      await api.post('/scanner/sync-offline', {
        sessionId,
        scans: pendingScans,
      });
      setPendingScans([]);
      localStorage.removeItem('pending-scans');
      const now = new Date().toISOString();
      setLastSync(now);
      localStorage.setItem('last-sync', now);
    } catch {}
  };

  // Download ticket list for offline
  const downloadTicketList = async () => {
    if (!showtimeId) return;
    try {
      const res = await api.get(`/scanner/showtime/${showtimeId}/ticket-list`);
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tickets-${showtimeId.slice(0, 8)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
  };

  // Override rejected scan
  const handleOverride = async () => {
    if (!lastScanData || !overrideNote.trim() || !sessionId) return;

    // Extract ticket code from QR data
    let ticketCode = lastScanData;
    try {
      const parsed = JSON.parse(lastScanData);
      const payload = JSON.parse(parsed.payload);
      ticketCode = payload.ticketCode;
    } catch {}

    try {
      await api.post('/scanner/override', {
        ticketCode,
        sessionId,
        staffNote: overrideNote,
      });
      setScanResult({ result: 'VALID', message: 'Override approved by staff' });
      setShowOverride(false);
      setOverrideNote('');
    } catch (err: any) {
      setScanResult({ result: 'INVALID', message: err?.response?.data?.message || 'Override failed' });
    }
  };

  const resultConfig: Record<string, { color: string; bg: string; label: string }> = {
    VALID: { color: 'text-green-400', bg: 'bg-green-500/10 border-green-500/30', label: 'Entry Approved' },
    ALREADY_USED: { color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30', label: 'Already Used' },
    WRONG_SHOWTIME: { color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/30', label: 'Wrong Showtime' },
    CANCELLED: { color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30', label: 'Ticket Cancelled' },
    NOT_FOUND: { color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30', label: 'Not Found' },
    INVALID: { color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/30', label: 'Invalid' },
  };

  // Parse seat label into row/seat for display
  const parseSeatLabel = (label: string) => {
    // Try "Row X, Seat Y" or "A10" or "A-10" patterns
    const match = label.match(/^([A-Za-z]+)\s*[-]?\s*(\d+)$/);
    if (match) return { row: match[1], seat: match[2] };
    return null;
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gradient">
          <QrCodeIcon className="mr-2 inline h-7 w-7" />
          Ticket Scanner
        </h1>
        <div className="flex items-center gap-2">
          {!isOnline ? (
            <span className="flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-400">
              <ExclamationTriangleIcon className="h-3.5 w-3.5" />
              Offline
            </span>
          ) : (
            <span className="flex items-center gap-1 text-xs text-green-400">
              <WifiIcon className="h-3.5 w-3.5" />
              Online
            </span>
          )}
        </div>
      </div>

      {/* Session Setup (if no active session) */}
      {!sessionId ? (
        <div className="glass-card mt-6 space-y-4 p-6">
          <h2 className="text-lg font-semibold text-gray-100">Start Scan Session</h2>
          <p className="text-sm text-gray-400">Select a showtime and gate to begin scanning tickets.</p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-300">Showtime</label>
              <select
                value={showtimeId}
                onChange={(e) => setShowtimeId(e.target.value)}
                className="input-field text-gray-100 [&>option]:bg-[#1a1a1a] [&>option]:text-gray-100"
              >
                <option value="">Select showtime...</option>
                {showtimes.map((st) => (
                  <option key={st.id} value={st.id}>{st.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-300">Gate</label>
              <select value={gate} onChange={(e) => setGate(e.target.value)} className="input-field text-gray-100 [&>option]:bg-[#1a1a1a] [&>option]:text-gray-100">
                {['A', 'B', 'C', 'D'].map((g) => (
                  <option key={g} value={g}>Gate {g}</option>
                ))}
              </select>
            </div>
          </div>

          <button
            onClick={startSession}
            disabled={!showtimeId || loadingShowtimes}
            className="btn-primary w-full"
          >
            Start Session
          </button>
        </div>
      ) : (
        <>
          {/* Active Session Info */}
          <div className="glass-card mt-6 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-400">Session Active</p>
                <p className="text-xs text-gray-400">
                  {sessionInfo?.showtime?.event?.title} — Gate {gate}
                </p>
              </div>
              <button onClick={endSession} className="btn-danger text-sm">
                End Session
              </button>
            </div>
          </div>

          {/* Camera & Scanning */}
          <div className="glass-card mt-4 space-y-4 p-4">
            <div className="flex gap-3">
              {!scanning ? (
                <button onClick={startCamera} className="btn-primary flex items-center gap-2">
                  <VideoCameraIcon className="h-4 w-4" />
                  Start Camera
                </button>
              ) : (
                <button onClick={stopCamera} className="btn-danger flex items-center gap-2">
                  <StopIcon className="h-4 w-4" />
                  Stop Camera
                </button>
              )}
            </div>

            {/* Camera view - video always in DOM so ref works */}
            {scanning && (
              <p className="flex items-center gap-2 text-sm text-green-400 animate-pulse">
                <span className="h-2.5 w-2.5 rounded-full bg-green-400" />
                Camera active — point at QR code
              </p>
            )}
            <div className={cn('relative overflow-hidden rounded-xl border-2 border-orange-500/30 bg-black', !scanning && 'hidden')} style={{ minHeight: '320px' }}>
              <video
                ref={videoRef}
                style={{ width: '100%', height: '320px', objectFit: 'cover', display: 'block' }}
              />
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="relative h-52 w-52 rounded-2xl border-4 border-orange-400/60 shadow-[0_0_40px_rgba(249,115,22,0.2)]">
                  <div className="absolute -left-1 -top-1 h-6 w-6 border-l-4 border-t-4 border-orange-400 rounded-tl-lg" />
                  <div className="absolute -right-1 -top-1 h-6 w-6 border-r-4 border-t-4 border-orange-400 rounded-tr-lg" />
                  <div className="absolute -bottom-1 -left-1 h-6 w-6 border-b-4 border-l-4 border-orange-400 rounded-bl-lg" />
                  <div className="absolute -bottom-1 -right-1 h-6 w-6 border-b-4 border-r-4 border-orange-400 rounded-br-lg" />
                </div>
              </div>
              <p className="absolute bottom-3 left-0 right-0 text-center text-sm font-medium text-white/80 pointer-events-none">
                Align QR code within the frame
              </p>
            </div>

            {/* Manual entry */}
            <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-4">
              <label className="mb-2 block text-sm font-semibold text-orange-400">
                Manual Ticket Verification
              </label>
              <p className="mb-3 text-xs text-gray-500">
                Paste the QR code data (JSON) or scan result from an external QR reader app
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => setManualCode(e.target.value)}
                  placeholder='Paste QR data here...'
                  className="input-field flex-1 font-mono text-xs"
                  onKeyDown={(e) => e.key === 'Enter' && handleManualVerify()}
                />
                <button onClick={handleManualVerify} disabled={!manualCode.trim()} className="btn-primary px-8">
                  Verify
                </button>
              </div>
            </div>
          </div>

          {/* Scan Result — Large prominent display */}
          {scanResult && (
            <div
              className={cn(
                'mt-4 rounded-2xl border-4 p-8 text-center transition-all duration-300 animate-scale-in',
                scanResult.result === 'VALID'
                  ? 'border-green-500 bg-green-500/15 shadow-[0_0_40px_rgba(34,197,94,0.3)]'
                  : 'border-red-500 bg-red-500/15 shadow-[0_0_40px_rgba(239,68,68,0.3)]',
              )}
            >
              <div className="flex flex-col items-center gap-3">
                {scanResult.result === 'VALID' ? (
                  <CheckCircleIcon className="h-20 w-20 text-green-400" />
                ) : (
                  <XCircleIcon className="h-20 w-20 text-red-400" />
                )}
                <h3 className={cn(
                  'text-4xl font-black uppercase tracking-wider',
                  scanResult.result === 'VALID' ? 'text-green-400' : 'text-red-400',
                )}>
                  {scanResult.result === 'VALID' ? 'VALID' : 'INVALID'}
                </h3>
                <p className="text-lg font-medium text-gray-300">
                  {resultConfig[scanResult.result]?.label || scanResult.result}
                </p>
                {scanResult.seatLabel && (
                  <div className="mt-2 rounded-xl bg-white/10 px-6 py-3">
                    <p className="text-2xl font-bold text-white">
                      {(() => {
                        const parsed = parseSeatLabel(scanResult.seatLabel);
                        if (parsed) return `Row ${parsed.row} — Seat ${parsed.seat}`;
                        return scanResult.seatLabel;
                      })()}
                    </p>
                  </div>
                )}
                {scanResult.ticketCode && (
                  <p className="mt-1 font-mono text-sm text-gray-500">
                    Ticket: {scanResult.ticketCode}
                  </p>
                )}
                {scanResult.message && (
                  <p className="mt-1 text-sm text-gray-400">{scanResult.message}</p>
                )}
              </div>

              {/* Override for rejected scans */}
              {scanResult.result !== 'VALID' && (
                <div className="mt-4 border-t border-white/10 pt-4">
                  {!showOverride ? (
                    <button
                      onClick={() => setShowOverride(true)}
                      className="btn-secondary text-sm"
                    >
                      Override — Allow Entry
                    </button>
                  ) : (
                    <div className="space-y-3">
                      <textarea
                        value={overrideNote}
                        onChange={(e) => setOverrideNote(e.target.value)}
                        placeholder="Reason for override (e.g., Customer showed physical ID)..."
                        className="input-field"
                        rows={2}
                      />
                      <div className="flex gap-2">
                        <button
                          onClick={handleOverride}
                          disabled={!overrideNote.trim()}
                          className="btn-primary text-sm"
                        >
                          Confirm Override
                        </button>
                        <button
                          onClick={() => setShowOverride(false)}
                          className="btn-secondary text-sm"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Offline tools */}
          <div className="glass-card mt-4 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                {pendingScans.length > 0 && (
                  <p className="text-sm text-amber-400">
                    {pendingScans.length} scan(s) pending sync
                  </p>
                )}
                {lastSync && (
                  <p className="text-xs text-gray-500">
                    Last sync: {new Date(lastSync).toLocaleTimeString()}
                  </p>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={syncPending}
                  disabled={pendingScans.length === 0 || !isOnline || !sessionId}
                  className="btn-secondary flex items-center gap-1 text-sm"
                >
                  <ArrowPathIcon className="h-4 w-4" />
                  Sync
                </button>
                <button
                  onClick={downloadTicketList}
                  disabled={!showtimeId}
                  className="btn-secondary flex items-center gap-1 text-sm"
                >
                  <ArrowDownTrayIcon className="h-4 w-4" />
                  Download List
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
