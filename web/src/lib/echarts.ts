import * as echarts from "echarts/core";
import { BarChart, LineChart, PieChart } from "echarts/charts";
import {
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import "echarts-wordcloud"; // 副作用注册 wordCloud 系列（echarts-wordcloud@2 无命名导出）

// 按需注册（避免全量引入 echarts，大幅减小 bundle）
echarts.use([
  LineChart,
  BarChart,
  PieChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  CanvasRenderer,
]);

export default echarts;
