import Chart, { type ChartConfiguration, type Plugin } from 'chart.js/auto';
import 'chartjs-adapter-date-fns';
import { de } from 'date-fns/locale';

// The charts of the site have one series each: a member's or a faction's rate over time, or a ranking. They take their
// colours from the theme (--chart-series, validated against both chart surfaces) and follow the system when it
// switches between light and dark.

type ChartColors = {
  series: string;
  wash: string;
  text: string;
  muted: string;
  grid: string;
  surface: string;
};

function chartColors(): ChartColors {
  const style = getComputedStyle(document.documentElement);
  const read = (name: string) => style.getPropertyValue(name).trim();
  const series = read('--chart-series');
  return {
    series,
    wash: withAlpha(series, 0.1),
    text: read('--color-base-content'),
    muted: withAlpha(read('--color-base-content'), 0.7),
    grid: read('--color-base-300'),
    surface: read('--color-base-100'),
  };
}

// The theme defines its colours as #rrggbb; the canvas takes the transparency as an alpha channel.
function withAlpha(hex: string, alpha: number): string {
  const channel = Math.round(alpha * 255)
    .toString(16)
    .padStart(2, '0');
  return /^#[0-9a-f]{6}$/i.test(hex) ? `${hex}${channel}` : hex;
}

Chart.defaults.font.family = "'DM Sans', ui-sans-serif, system-ui, sans-serif";
Chart.defaults.font.size = 12;

// Each chart keeps how to repaint itself, so a switch between light and dark reaches all of them.
const repaints: Array<(colors: ChartColors) => void> = [];

window
  .matchMedia('(prefers-color-scheme: dark)')
  .addEventListener('change', () => {
    const colors = chartColors();
    for (const repaint of repaints) repaint(colors);
  });

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyChart = Chart<any, any>;
type AnyChartConfiguration = ChartConfiguration<any, any>;
/* eslint-enable @typescript-eslint/no-explicit-any */

// Chart.js draws as soon as it is constructed and keeps the options it resolved then, so the colours go into the
// configuration first; a repaint writes them into the live chart and redraws it in full.
function createChart<TChart extends AnyChart>(
  canvas: HTMLCanvasElement,
  config: AnyChartConfiguration,
  paint: (
    config: Pick<AnyChartConfiguration, 'data' | 'options'>,
    colors: ChartColors,
  ) => void,
): TChart {
  paint(config, chartColors());
  const chart = new Chart(canvas, config) as TChart;
  repaints.push((colors) => {
    paint(chart, colors);
    chart.update();
  });
  return chart;
}

export type HistoryPoint = { date: string; value: number | null };

// Change over time of one rate. Monotone interpolation never overshoots the data, so a rate never seems to pass 100 %;
// only the latest value carries a marker, the tooltip names every other.
export function historyLineChart(
  canvas: HTMLCanvasElement,
  history: HistoryPoint[],
  formatValue: (value: number | null) => string,
): Chart<'line', HistoryPoint[]> {
  const lastIndex = history.length - 1;
  const config: ChartConfiguration<'line', HistoryPoint[]> = {
    type: 'line',
    data: {
      datasets: [
        {
          data: history,
          fill: 'origin',
          borderWidth: 2,
          cubicInterpolationMode: 'monotone',
        },
      ],
    },
    options: {
      parsing: { xAxisKey: 'date', yAxisKey: 'value' },
      interaction: { mode: 'index', intersect: false },
      elements: {
        point: {
          radius: (context) => (context.dataIndex === lastIndex ? 4 : 0),
          hoverRadius: 5,
          borderWidth: 2,
          hitRadius: 12,
        },
        line: { borderCapStyle: 'round', borderJoinStyle: 'round' },
      },
      scales: {
        x: {
          type: 'time',
          time: { unit: 'month', tooltipFormat: 'd. MMMM yyyy' },
          adapters: { date: { locale: de } },
          ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 6 },
          grid: { display: false },
          border: { display: false },
        },
        y: {
          ticks: {
            maxTicksLimit: 5,
            callback: (value) =>
              typeof value === 'number' ? formatValue(value) : value,
          },
          border: { display: false },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          displayColors: false,
          callbacks: { label: (item) => formatValue(item.parsed.y) },
        },
      },
    },
  };
  return createChart(canvas, config, (target, colors) => {
    Object.assign(target.data.datasets[0], {
      borderColor: colors.series,
      backgroundColor: colors.wash,
      pointBackgroundColor: colors.series,
      pointBorderColor: colors.surface,
    });
    styleAxes(target, colors);
  });
}

export type RankingPoint = { label: string; value: number; valueLabel: string };

// A ranking of factions, parties or speakers: names on the axis, the value at the tip of each bar, never inside it.
export function rankingBarChart<Point extends RankingPoint>(
  canvas: HTMLCanvasElement,
  points: Point[],
  onSelect?: (point: Point) => void,
): Chart<'bar', Point[]> {
  const valuePadding = widestValueLabel(canvas, points) + 12;
  // Chart.js gives a vertical axis at most half of the width that the value labels leave.
  const nameWidth = () => (canvas.clientWidth - valuePadding) / 2 - 12;
  const config: ChartConfiguration<'bar', Point[]> = {
    type: 'bar',
    data: {
      datasets: [
        {
          data: points,
          parsing: { xAxisKey: 'value', yAxisKey: 'label' },
          maxBarThickness: 20,
          borderRadius: { topRight: 4, bottomRight: 4 },
          borderSkipped: 'start',
          borderWidth: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      indexAxis: 'y',
      layout: { padding: { right: valuePadding } },
      scales: {
        x: { display: false, beginAtZero: true },
        y: {
          grid: { display: false },
          border: { display: false },
          ticks: {
            autoSkip: false,
            callback: (_value, index) =>
              wrapLabel(canvas, points[index].label, nameWidth()),
          },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          displayColors: false,
          callbacks: {
            title: (items) => (items[0]?.raw as Point | undefined)?.label ?? '',
            label: (item) => (item.raw as Point).valueLabel,
          },
        },
      },
      onHover: (event, elements) => {
        const target = event.native?.target as HTMLElement | undefined;
        if (target)
          target.style.cursor =
            onSelect && elements.length ? 'pointer' : 'default';
      },
      onClick: (_event, elements) => {
        if (onSelect && elements[0]) onSelect(points[elements[0].index]);
      },
    },
    plugins: [valueAtBarTip],
  };
  return createChart(canvas, config, (target, colors) => {
    Object.assign(target.data.datasets[0], {
      backgroundColor: colors.series,
      hoverBackgroundColor: colors.series,
    });
    styleAxes(target, colors, { namesInText: true });
  });
}

const valueAtBarTip: Plugin<'bar'> = {
  id: 'valueAtBarTip',
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    const colors = chartColors();
    const meta = chart.getDatasetMeta(0);
    ctx.save();
    ctx.font = `12px ${Chart.defaults.font.family}`;
    ctx.fillStyle = colors.text;
    ctx.textBaseline = 'middle';
    meta.data.forEach((bar, index) => {
      const point = chart.data.datasets[0].data[
        index
      ] as unknown as RankingPoint;
      ctx.fillText(point.valueLabel, bar.x + 6, bar.y);
    });
    ctx.restore();
  },
};

// Chart.js cuts axis labels that are wider than its axis; long names break into at most two lines, which fit a bar's
// row, and what still does not fit ends in an ellipsis. The tooltip names the bar in full.
function wrapLabel(
  canvas: HTMLCanvasElement,
  label: string,
  maxWidth: number,
): string[] {
  const context = canvas.getContext('2d');
  if (!context) return [label];
  context.font = `12px ${Chart.defaults.font.family}`;
  const fits = (text: string) => context.measureText(text).width <= maxWidth;
  const lines: string[] = [];
  for (const word of label.split(' ')) {
    const current = lines.at(-1);
    if (current !== undefined && fits(`${current} ${word}`))
      lines[lines.length - 1] = `${current} ${word}`;
    else lines.push(word);
  }
  const shown = lines.length > 2 ? [lines[0], lines.slice(1).join(' ')] : lines;
  return shown.map((line) => (fits(line) ? line : ellipsize(line, fits)));
}

function ellipsize(text: string, fits: (text: string) => boolean): string {
  let shortened = text;
  while (shortened.length > 1 && !fits(`${shortened}…`))
    shortened = shortened.slice(0, -1);
  return `${shortened}…`;
}

function widestValueLabel(
  canvas: HTMLCanvasElement,
  points: RankingPoint[],
): number {
  const context = canvas.getContext('2d');
  if (!context) return 60;
  context.font = `12px ${Chart.defaults.font.family}`;
  return Math.ceil(
    Math.max(
      0,
      ...points.map((point) => context.measureText(point.valueLabel).width),
    ),
  );
}

// Axis values recede in muted ink; the names of a ranking are what it is read by, so they keep the text colour.
function styleAxes(
  target: Pick<AnyChartConfiguration, 'options'>,
  colors: ChartColors,
  { namesInText = false } = {},
) {
  type AxisColors = { ticks?: { color?: string }; grid?: { color?: string } };
  const options = (target.options ??= {});
  const scales = (options.scales ?? {}) as Record<
    string,
    AxisColors | undefined
  >;
  for (const [axis, scale] of Object.entries(scales)) {
    if (!scale) continue;
    if (scale.ticks)
      scale.ticks.color =
        namesInText && axis === 'y' ? colors.text : colors.muted;
    if (scale.grid) scale.grid.color = colors.grid;
  }
  const tooltip = options.plugins?.tooltip;
  if (tooltip) {
    Object.assign(tooltip, {
      backgroundColor: colors.surface,
      titleColor: colors.text,
      bodyColor: colors.text,
      borderColor: colors.grid,
      borderWidth: 1,
    });
  }
}
