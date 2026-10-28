import React, { useState, useEffect } from 'react';
import {
  Laptop,
  Smartphone,
  Monitor,
  Volume2,
  Play,
  Pause,
  SkipForward,
  X,
  Radio,
  CheckCircle2,
  RefreshCw,
} from 'lucide-react';
import { vybeConnect, ConnectDevice, ConnectCommand } from '../../services/socialEngine';
import { TrackMetadata } from '../../providers/types';

interface VybeConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentTrack: TrackMetadata | null;
  currentTime: number;
  isPlaying: boolean;
  volume: number;
  onTransferPlayback: (track: TrackMetadata, timestamp: number, isPlaying: boolean) => void;
  onRemotePlayPause: () => void;
  onRemoteSeek: (time: number) => void;
}

export const VybeConnectModal: React.FC<VybeConnectModalProps> = ({
  isOpen,
  onClose,
  currentTrack,
  currentTime,
  isPlaying,
  volume,
  onTransferPlayback,
}) => {
  const [devices, setDevices] = useState<ConnectDevice[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const myDeviceId = vybeConnect.getDeviceId();

  useEffect(() => {
    if (!isOpen) return;

    // Listen to device changes
    const unsub = vybeConnect.onDevicesChange((devs) => {
      setDevices(devs);
    });

    // Refresh immediately
    vybeConnect.pollState();

    return () => unsub();
  }, [isOpen]);

  // Listen to remote commands sent to this device
  useEffect(() => {
    const unsub = vybeConnect.onCommand((cmd: ConnectCommand) => {
      if (cmd.command === 'TRANSFER_PLAYBACK' && cmd.payload) {
        const { track, currentTime: targetTime, isPlaying: targetPlaying } = cmd.payload;
        if (track) {
          onTransferPlayback(track, targetTime || 0, targetPlaying !== undefined ? targetPlaying : true);
        }
      }
    });
    return () => unsub();
  }, [onTransferPlayback]);

  if (!isOpen) return null;

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await vybeConnect.pollState();
    setTimeout(() => setIsRefreshing(false), 600);
  };

  const handleTransferFromRemote = (targetDev: ConnectDevice) => {
    if (targetDev.currentTrack) {
      onTransferPlayback(targetDev.currentTrack, targetDev.currentTime || 0, targetDev.isPlaying);
    }
  };

  const handleTransferToRemote = async (targetDev: ConnectDevice) => {
    if (!currentTrack) return;
    await vybeConnect.sendCommand(targetDev.deviceId, 'TRANSFER_PLAYBACK', {
      track: currentTrack,
      currentTime,
      isPlaying,
    });
  };

  const handleRemotePlayPause = async (targetDev: ConnectDevice) => {
    await vybeConnect.sendCommand(targetDev.deviceId, targetDev.isPlaying ? 'PAUSE' : 'PLAY');
    vybeConnect.pollState();
  };

  const handleRemoteNext = async (targetDev: ConnectDevice) => {
    await vybeConnect.sendCommand(targetDev.deviceId, 'NEXT');
    vybeConnect.pollState();
  };

  const getDeviceIcon = (type: string, isSelf = false) => {
    const colorClass = isSelf ? 'text-emerald-400' : 'text-zinc-300';
    if (type === 'phone') return <Smartphone className={`w-6 h-6 ${colorClass}`} />;
    if (type === 'desktop') return <Monitor className={`w-6 h-6 ${colorClass}`} />;
    return <Laptop className={`w-6 h-6 ${colorClass}`} />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div
        className="relative w-full max-w-md bg-[#111116] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 text-emerald-400">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white tracking-tight flex items-center gap-2">
                Vybe Connect
                <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-bold">
                  Active
                </span>
              </h2>
              <p className="text-xs text-zinc-400">Control & switch playback across your devices</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleRefresh}
              className={`p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors ${
                isRefreshing ? 'animate-spin text-emerald-400' : ''
              }`}
              title="Refresh Devices"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Current Device Banner */}
        <div className="p-4 bg-emerald-950/20 border-b border-emerald-500/15 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
              {getDeviceIcon(vybeConnect.getDeviceType(), true)}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white">{vybeConnect.getDeviceName()}</span>
                <span className="text-[10px] text-emerald-400 font-medium">(This Device)</span>
              </div>
              <p className="text-xs text-emerald-400/80 flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping inline-block" />
                {isPlaying ? 'Currently Playing Here' : 'Ready to stream'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-mono text-zinc-400">
            <Volume2 className="w-3.5 h-3.5 text-zinc-400" />
            {Math.round(volume * 100)}%
          </div>
        </div>

        {/* Device List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <div className="text-[11px] font-semibold tracking-wider text-zinc-400 uppercase px-1">
            Available Devices on Network ({devices.filter((d) => d.deviceId !== myDeviceId).length})
          </div>

          {devices.filter((d) => d.deviceId !== myDeviceId).length === 0 ? (
            <div className="py-8 px-4 text-center rounded-xl border border-dashed border-white/10 bg-white/[0.01]">
              <Smartphone className="w-8 h-8 text-zinc-600 mx-auto mb-2 opacity-60" />
              <p className="text-sm font-medium text-zinc-300">No other devices detected</p>
              <p className="text-xs text-zinc-500 mt-1 max-w-xs mx-auto">
                Open Vybe on your Android Phone or another browser tab to seamlessly hand off audio without missing a beat.
              </p>
            </div>
          ) : (
            devices
              .filter((d) => d.deviceId !== myDeviceId)
              .map((dev) => (
                <div
                  key={dev.deviceId}
                  className="p-3.5 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/5 transition-all group"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10">
                        {getDeviceIcon(dev.deviceType)}
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-white flex items-center gap-1.5">
                          {dev.deviceName}
                          {dev.isPlaying && (
                            <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400" />
                          )}
                        </h4>
                        {dev.currentTrack ? (
                          <p className="text-xs text-zinc-400 truncate max-w-[190px]">
                            {dev.isPlaying ? 'Playing: ' : 'Paused: '}
                            <span className="text-zinc-200 font-medium">
                              {dev.currentTrack.title}
                            </span>{' '}
                            • {dev.currentTrack.artist}
                          </p>
                        ) : (
                          <p className="text-xs text-zinc-500">Idle • Ready to connect</p>
                        )}
                      </div>
                    </div>

                    {/* Remote Controls */}
                    <div className="flex items-center gap-1.5">
                      {dev.currentTrack && (
                        <>
                          <button
                            onClick={() => handleRemotePlayPause(dev)}
                            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition-colors"
                            title={dev.isPlaying ? 'Remote Pause' : 'Remote Play'}
                          >
                            {dev.isPlaying ? (
                              <Pause className="w-3.5 h-3.5" />
                            ) : (
                              <Play className="w-3.5 h-3.5 fill-current" />
                            )}
                          </button>
                          <button
                            onClick={() => handleRemoteNext(dev)}
                            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white transition-colors"
                            title="Remote Skip"
                          >
                            <SkipForward className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Transfer Action Bar */}
                  <div className="mt-3 pt-3 border-t border-white/5 flex items-center gap-2">
                    {dev.currentTrack && (
                      <button
                        onClick={() => handleTransferFromRemote(dev)}
                        className="flex-1 py-1.5 px-3 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-xs font-medium transition-colors flex items-center justify-center gap-1.5"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Transfer Playback Here
                      </button>
                    )}
                    {currentTrack && (
                      <button
                        onClick={() => handleTransferToRemote(dev)}
                        className="flex-1 py-1.5 px-3 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-zinc-300 hover:text-white text-xs font-medium transition-colors"
                      >
                        Play on {dev.deviceName.split(' ')[0]}
                      </button>
                    )}
                  </div>
                </div>
              ))
          )}
        </div>

        {/* Footer info */}
        <div className="px-6 py-3.5 bg-black/40 border-t border-white/5 flex items-center justify-between text-[11px] text-zinc-500 font-mono">
          <span>ID: {myDeviceId.substring(0, 12)}...</span>
          <span>Zero-Latency Audio Mesh</span>
        </div>
      </div>
    </div>
  );
};
