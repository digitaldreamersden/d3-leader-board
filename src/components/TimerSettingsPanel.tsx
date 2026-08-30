import React, { useState, useEffect } from "react";
import { useTimer } from "@/contexts/TimerContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Timer, ArrowUp, ArrowDown } from "lucide-react";

interface TimerSettingsPanelProps {
  onSave?: () => void;
}

const TimerSettingsPanel: React.FC<TimerSettingsPanelProps> = ({ onSave }) => {
  const { state: timerState, configure } = useTimer();

  // Initialize from current timer state
  const [minutes, setMinutes] = useState<string>(
    String(Math.floor(timerState.durationSeconds / 60))
  );
  const [seconds, setSeconds] = useState<string>(
    String(timerState.durationSeconds % 60)
  );
  const [mode, setMode] = useState<"count-up" | "countdown">(timerState.mode);
  const [error, setError] = useState<string>("");

  // Sync local state when timer state changes externally (e.g. reset)
  useEffect(() => {
    setMinutes(String(Math.floor(timerState.durationSeconds / 60)));
    setSeconds(String(timerState.durationSeconds % 60));
    setMode(timerState.mode);
  }, [timerState.durationSeconds, timerState.mode]);

  const isDisabled = timerState.status === "running" || timerState.status === "paused";

  const validate = (mins: string, secs: string): string => {
    const m = parseInt(mins, 10) || 0;
    const s = parseInt(secs, 10) || 0;
    const total = m * 60 + s;
    if (total < 1) {
      return "Duration must be at least 1 second.";
    }
    if (total > 86400) {
      return "Duration cannot exceed 86400 seconds (24 hours).";
    }
    return "";
  };

  const handleMinutesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setMinutes(val);
    setError(validate(val, seconds));
  };

  const handleSecondsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setSeconds(val);
    setError(validate(minutes, val));
  };

  const handleModeChange = (value: string) => {
    if (value === "count-up" || value === "countdown") {
      setMode(value);
    }
  };

  const handleSave = () => {
    const validationError = validate(minutes, seconds);
    if (validationError) {
      setError(validationError);
      return;
    }
    const m = parseInt(minutes, 10) || 0;
    const s = parseInt(seconds, 10) || 0;
    const totalSeconds = m * 60 + s;
    configure({ mode, durationSeconds: totalSeconds });
    setError("");
    onSave?.();
  };

  return (
    <div className="space-y-4 p-2">
      <div className="flex items-center gap-2 mb-2">
        <Timer className="w-4 h-4 text-gray-400" />
        <h3 className="text-sm font-semibold text-white">Timer Settings</h3>
      </div>

      {/* Mode Toggle */}
      <div className="space-y-2">
        <Label className="text-gray-300">Mode</Label>
        <ToggleGroup
          type="single"
          value={mode}
          onValueChange={handleModeChange}
          disabled={isDisabled}
          className="w-full"
        >
          <ToggleGroupItem
            value="countdown"
            className="flex-1 text-xs data-[state=on]:bg-blue-600 data-[state=on]:text-white"
            aria-label="Countdown mode"
          >
            <ArrowDown className="w-3 h-3 mr-1" />
            Countdown
          </ToggleGroupItem>
          <ToggleGroupItem
            value="count-up"
            className="flex-1 text-xs data-[state=on]:bg-blue-600 data-[state=on]:text-white"
            aria-label="Count up mode"
          >
            <ArrowUp className="w-3 h-3 mr-1" />
            Count Up
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      {/* Duration Inputs */}
      <div className="space-y-2">
        <Label className="text-gray-300">Duration</Label>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <Input
              type="number"
              min={0}
              max={1440}
              value={minutes}
              onChange={handleMinutesChange}
              disabled={isDisabled}
              placeholder="Min"
              className="bg-gray-700 border-gray-600 text-white"
              aria-label="Minutes"
            />
            <span className="text-xs text-gray-400 mt-1 block">Minutes</span>
          </div>
          <span className="text-gray-400 text-lg font-bold">:</span>
          <div className="flex-1">
            <Input
              type="number"
              min={0}
              max={59}
              value={seconds}
              onChange={handleSecondsChange}
              disabled={isDisabled}
              placeholder="Sec"
              className="bg-gray-700 border-gray-600 text-white"
              aria-label="Seconds"
            />
            <span className="text-xs text-gray-400 mt-1 block">Seconds</span>
          </div>
        </div>
      </div>

      {/* Validation Error */}
      {error && (
        <p className="text-red-400 text-xs" role="alert">
          {error}
        </p>
      )}

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={isDisabled || !!error}
        className="w-full px-3 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Save Settings
      </button>

      {isDisabled && (
        <p className="text-xs text-gray-500 text-center">
          Settings cannot be changed while the timer is running or paused.
        </p>
      )}
    </div>
  );
};

export default TimerSettingsPanel;
