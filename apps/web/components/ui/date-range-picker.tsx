"use client";

import React, { useEffect } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { format, isSameDay } from "date-fns";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { enUS } from "date-fns/locale";

// Helper functions to get start/end of day in LOCAL timezone (preserves the date)
function getStartOfDayLocal(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function getEndOfDayLocal(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

interface DateRange {
  from: Date | undefined;
  to: Date | undefined;
}

interface DatePickerWithRangeProps {
  className?: string;
  dateRange?: DateRange;
  setDateRange?: (range: DateRange) => void;
}

export function DatePickerWithRange({ className, dateRange, setDateRange }: DatePickerWithRangeProps) {
  const startDate = dateRange?.from;
  const endDate = dateRange?.to;

  // Debug: Log when dateRange prop changes
  useEffect(() => {
    console.log('[DatePicker] dateRange prop changed:', {
      from: dateRange?.from?.toISOString(),
      to: dateRange?.to?.toISOString(),
      fromFormatted: dateRange?.from ? format(dateRange.from, 'yyyy-MM-dd HH:mm:ss') : 'N/A',
      toFormatted: dateRange?.to ? format(dateRange.to, 'yyyy-MM-dd HH:mm:ss') : 'N/A'
    });
  }, [dateRange]);

  const onChange = (dates: [Date | null, Date | null]) => {
    const [start, end] = dates;

    console.log('[DatePicker] onChange called with:', {
      start: start?.toISOString(),
      end: end?.toISOString()
    });

    if (setDateRange && start) {
      if (!end) {
        // First click: Select just that single day (end is null to allow range picking)
        const newRange = {
          from: getStartOfDayLocal(start),
          to: undefined
        };
        console.log('[DatePicker] Setting single-day range:', newRange);
        setDateRange(newRange);
      } else {
        // Second click: Select the range
        const newRange = {
          from: getStartOfDayLocal(start),
          to: getEndOfDayLocal(end)
        };
        console.log('[DatePicker] Setting date range:', newRange);
        setDateRange(newRange);
      }
    }
  };

  const isToday = startDate && endDate && isSameDay(startDate, new Date()) && isSameDay(endDate, new Date());

  // Format the display text
  const getDisplayText = () => {
    if (!startDate) return "Select Date Range";
    if (!endDate) return format(startDate, "MMM dd, yyyy");
    if (isSameDay(startDate, endDate)) return format(startDate, "MMMM dd, yyyy");
    return `${format(startDate, "MMM dd")} - ${format(endDate, "MMM dd, yyyy")}`;
  };

  return (
    <div className={cn("date-picker-wrapper", className)}>
      <DatePicker
        locale={enUS}
        onChange={onChange}
        startDate={startDate}
        endDate={endDate}
        selectsRange
        monthsShown={2}
        dateFormat="MMM dd, yyyy"
        placeholderText="Select date range"
        maxDate={new Date()}
        customInput={
          <button
            type="button"
            className={cn(
              "w-[280px] justify-between text-left font-bold text-xs bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl py-3 px-5 flex items-center gap-2 hover:border-green-500 hover:ring-4 hover:ring-green-500/5 transition-all shadow-sm group"
            )}
          >
            <div className="flex items-center gap-3">
              <div className="p-1.5 bg-green-500/10 rounded-lg group-hover:bg-green-500/20 transition-colors">
                <CalendarIcon className="h-4 w-4 text-green-600" />
              </div>
              <div className="flex flex-col text-left">
                <span className="text-[10px] text-neutral-400 uppercase tracking-tighter leading-none mb-0.5">Report Period</span>
                <span className="truncate leading-none text-neutral-700 dark:text-neutral-200">
                  {isToday ? "Today (Live)" : getDisplayText()}
                </span>
              </div>
            </div>
            <span className="text-xs text-neutral-400 group-hover:text-green-500 transition-colors">
              {startDate && endDate && !isSameDay(startDate, endDate)
                ? `${Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1} days`
                : "▼"}
            </span>
          </button>
        }
      />
    </div>
  );
}
