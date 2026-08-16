import { useEffect, useRef } from "react";
import type { EChartsOption } from "echarts";
import echarts from "../lib/echarts";

interface EChartProps {
  option: EChartsOption;
  className?: string;
  onEvents?: Record<string, (params: unknown) => void>;
}

/** ECharts 的 React 封装：初始化 / resize / setOption / dispose */
export default function EChart({ option, className, onEvents }: EChartProps) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const chart = echarts.init(el);
    chartRef.current = chart;
    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    chartRef.current?.setOption(option, true);
  }, [option]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart || !onEvents) return;
    for (const [name, fn] of Object.entries(onEvents)) chart.on(name, fn);
    return () => {
      for (const name of Object.keys(onEvents)) chart.off(name);
    };
  }, [onEvents]);

  return <div ref={ref} className={className ?? "h-64"} />;
}
