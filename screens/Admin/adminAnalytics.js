import React, { useState, useEffect } from "react";
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  Modal,
  FlatList,
  Button,
  Alert,
  Platform,
} from "react-native";

// Vector icons (using Expo's vector-icons wrapper which includes react-native-vector-icons)
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Header2 from "../navigation/adminHeader";

const { width: windowWidth } = Dimensions.get("window");

/**
 * AdminAnalytics (single-file)
 * - Line chart (guarded dynamic require)
 * - Grouped bar chart (pure RN)
 * - ReportsTab with System Overview, User Engagement, Performance Report
 *
 * To run the line chart you'll need:
 *   expo install react-native-svg
 *   npm install react-native-chart-kit
 *
 * To get the icons below:
 *   - Expo-managed apps: expo install @expo/vector-icons
 *   - Bare React Native apps: npm install react-native-vector-icons
 *     (linking not normally required on RN >= 0.60)
 *
 * The example numbers are demo/static — replace with your real metrics or API calls.
 */

/* Simple table icon built from Views so it always renders and fits the button.
   Props:
   - size: overall square size in px (default 18)
   - color: stroke color (default "#334e68" to match Export CSV text)
*/
function TableIcon({ size = 18, color = "#334e68", style }) {
  const strokeWidth = Math.max(1, Math.round(size * 0.12));
  const innerPadding = Math.max(2, Math.round(size * 0.14));
  const width = size;
  const height = size;

  // positions for the internal grid lines (one vertical and two horizontals -> 3x3 grid)
  const thirdX = (width - innerPadding * 2) / 3;
  const thirdY = (height - innerPadding * 2) / 3;

  return (
    <View style={[{ width, height, position: "relative" }, style]}>
      {/* outer rounded rect */}
      <View
        style={[
          styles.tableIconOuter,
          {
            borderColor: color,
            borderWidth: strokeWidth,
            borderRadius: Math.max(2, Math.round(size * 0.12)),
          },
        ]}
      />
      {/* vertical grid lines */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: innerPadding + thirdX - strokeWidth / 2,
          top: innerPadding,
          bottom: innerPadding,
          width: strokeWidth,
          backgroundColor: color,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          left: innerPadding + thirdX * 2 - strokeWidth / 2,
          top: innerPadding,
          bottom: innerPadding,
          width: strokeWidth,
          backgroundColor: color,
        }}
      />
      {/* horizontal grid lines */}
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: innerPadding + thirdY - strokeWidth / 2,
          left: innerPadding,
          right: innerPadding,
          height: strokeWidth,
          backgroundColor: color,
        }}
      />
      <View
        pointerEvents="none"
        style={{
          position: "absolute",
          top: innerPadding + thirdY * 2 - strokeWidth / 2,
          left: innerPadding,
          right: innerPadding,
          height: strokeWidth,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

/* DownloadBadge: clear, high-contrast download icon inside a circular badge.
   Using MaterialCommunityIcons 'download' for crisp rendering.
   Props:
   - size: diameter of circle (default 32)
   - bg: background color (default blue)
   - iconColor: icon color (default white)
*/
function DownloadBadge({ size = 32, bg = "#133E87", iconColor = "#fff", style }) {
  const iconSize = Math.round(size * 0.55);
  return (
    <View style={[{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: "center", justifyContent: "center" }, style]}>
      <MaterialCommunityIcons name="download" size={iconSize} color={iconColor} />
    </View>
  );
}

export default function AdminAnalytics() {
  const [range, setRange] = useState("Last 7 Days");
  const [LineChartComp, setLineChartComp] = useState(null);
  const [chartError, setChartError] = useState(null);
  const [activePoint, setActivePoint] = useState(null);

  useEffect(() => {
    try {
      // dynamic require so app doesn't crash when packages missing
      // eslint-disable-next-line global-require
      const { LineChart } = require("react-native-chart-kit");
      // eslint-disable-next-line global-require
      const RN_SVG = require("react-native-svg");

      if (!LineChart) throw new Error("react-native-chart-kit LineChart is undefined");
      if (!RN_SVG || !RN_SVG.Svg) throw new Error("react-native-svg seems missing or invalid");

      setLineChartComp(() => LineChart);
      setChartError(null);
    } catch (err) {
      console.warn("Chart init error:", err?.message ?? err);
      setChartError(err?.message ?? String(err));
      setLineChartComp(null);
    }
  }, []);

  // Note: icon values are MaterialCommunityIcons names
  const metrics = [
    { id: 1, title: "Total Users", value: 24, subtitle: "+3 this month", icon: "account-group" },
    { id: 2, title: "Active Sessions", value: 18, subtitle: "75% online", icon: "chart-areaspline" },
    { id: 3, title: "Active Sessions", value: 18, subtitle: "75% online", icon: "flash" },
    { id: 4, title: "Active Sessions", value: 18, subtitle: "75% online", icon: "alert-circle-outline" },
  ];

  const chartData = {
    labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
    datasets: [
      {
        data: [10, 12, 18, 20, 22, 25],
        color: (opacity = 1) => `rgba(21,71,133, ${opacity})`,
      },
    ],
  };
  const chartWidth = Math.max(windowWidth - 48, 200);
  const chartHeight = 220;

  const barData = [
    { label: "Mon", actions: 128, logins: 45 },
    { label: "Tue", actions: 152, logins: 52 },
    { label: "Wed", actions: 134, logins: 48 },
    { label: "Thu", actions: 160, logins: 55 },
    { label: "Fri", actions: 148, logins: 50 },
    { label: "Sat", actions: 95, logins: 35 },
    { label: "Sun", actions: 82, logins: 30 },
  ];

  const barChartHeight = 220;

  const showPointTooltip = (point) => {
    setActivePoint(point);
    setTimeout(() => setActivePoint(null), 2000);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <Header2 showBackButton={true} /> {/* Add the header at the top */}
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.pickerRow}>
          <Text style={styles.pickerLabel}>Select Date Range:</Text>
          <DateRangePicker
            selected={range}
            onChange={(r) => setRange(r)}
            options={["Last 7 Days", "Last 30 Days", "This Month", "Custom"]}
          />
        </View>

        <View style={styles.metricsGrid}>
          {metrics.map((m) => (
            <MetricCard key={m.id} icon={m.icon} title={m.title} value={m.value} subtitle={m.subtitle} />
          ))}
        </View>

        {/* Line chart */}
        <View style={{ width: "100%", marginTop: 8 }}>
          <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>User Growth Over Time</Text>

            {LineChartComp ? (
              (() => {
                try {
                  return (
                    <View style={{ position: "relative", width: chartWidth }}>
                      <LineChartComp
                        data={chartData}
                        width={chartWidth}
                        height={chartHeight}
                        chartConfig={{
                          backgroundGradientFrom: "#ffffff",
                          backgroundGradientTo: "#ffffff",
                          decimalPlaces: 0,
                          color: (opacity = 1) => `rgba(21,71,133, ${opacity})`,
                          labelColor: (opacity = 1) => `rgba(44, 62, 80, ${opacity})`,
                          propsForDots: { r: "4", strokeWidth: "2", stroke: "#154985" },
                        }}
                        bezier
                        style={{ marginTop: 8 }}
                        withVerticalLines={false}
                        withInnerLines={false}
                        withHorizontalLines={false}
                        fromZero
                        onDataPointClick={(data) => {
                          const point = {
                            index: data.index,
                            value: data.value,
                            label: chartData.labels[data.index],
                            x: data.x,
                            y: data.y,
                          };
                          showPointTooltip(point);
                        }}
                      />

                      {activePoint !== null && (
                        <View
                          pointerEvents="none"
                          style={[
                            styles.tooltipWrapper,
                            {
                              left: Math.max(6, activePoint.x - 1),
                              top: 0,
                              height: chartHeight,
                            },
                          ]}
                        >
                          <View
                            style={[
                              styles.tooltipVerticalLine,
                              {
                                top: activePoint.y + 4,
                                height: chartHeight - activePoint.y - 18,
                              },
                            ]}
                          />
                          <View
                            style={[
                              styles.tooltipBox,
                              {
                                position: "absolute",
                                bottom: chartHeight - activePoint.y + 10,
                                left: -40,
                              },
                            ]}
                          >
                            <Text style={styles.tooltipLabel}>{activePoint.label}</Text>
                            <Text style={styles.tooltipValue}>Users: {activePoint.value}</Text>
                          </View>
                        </View>
                      )}
                    </View>
                  );
                } catch (err) {
                  console.warn("Chart render error:", err?.message ?? err);
                  return null;
                }
              })()
            ) : null}
          </View>
        </View>

        {/* Grouped bar chart */}
        <View style={{ width: "100%", marginTop: 12 }}>
          <View style={[styles.chartCard, { overflow: "hidden", minHeight: barChartHeight + 80 }]}>
            <Text style={styles.chartTitle}>System Usage & Activity</Text>
            <GroupedBarChart data={barData} height={barChartHeight} />
          </View>
        </View>

        {/* Reports tab */}
        <View style={{ width: "100%", marginTop: 12 }}>
          <ReportsTab barData={barData} metrics={metrics} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* -------------------- GroupedBarChart -------------------- */
/* Side-by-side bars (login first, activity second), centered tooltip above the day column */
function GroupedBarChart({ data = [], height = 180 }) {
  const [layoutWidth, setLayoutWidth] = useState(0);
  const [active, setActive] = useState(null); // { index, centerRelative, top }
  const [tooltipWidth, setTooltipWidth] = useState(0);
  const totalSlots = data.length;

  const yAxisWidth = 44;
  const outerPadding = 12;
  const loginsColor = "#154985";
  const actionsColor = "#000";

  // nice max for y-axis
  const rawMax = Math.max(...data.map((d) => Math.max(d.actions, d.logins)), 1);
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawMax)));
  let niceMax = Math.ceil(rawMax / magnitude) * magnitude;
  if (niceMax / 2 >= rawMax) niceMax = niceMax / 2;
  const finalMax = niceMax;
  const ticks = 5;

  const onBarPress = (index, val) => {
    if (!layoutWidth) return;
    const innerWidth = layoutWidth - yAxisWidth - outerPadding * 2;
    const columnWidth = innerWidth / totalSlots;
    const centerRelative = index * columnWidth + columnWidth / 2;
    const barTop = height - (val / finalMax) * height;
    const tooltipTop = Math.max(6, barTop - 60);
    setActive({ index, centerRelative, top: tooltipTop });
    setTimeout(() => setActive(null), 2400);
  };

  return (
    <View
      style={{ width: "100%", paddingHorizontal: outerPadding, paddingTop: 8 }}
      onLayout={(e) => setLayoutWidth(e.nativeEvent.layout.width)}
    >
      <View style={{ height }} />

      {layoutWidth > 0 && (
        <View style={{ position: "absolute", top: 8, left: outerPadding, right: outerPadding }}>
          <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
            {/* Y axis */}
            <View style={{ width: yAxisWidth, height }}>
              {Array.from({ length: ticks }).map((_, i) => {
                const ratio = i / (ticks - 1);
                const value = Math.round((1 - ratio) * finalMax);
                const topPos = ratio * height - 8;
                return (
                  <View key={i} style={{ position: "absolute", top: Math.max(0, topPos), left: 0, right: 0 }}>
                    <Text style={{ fontSize: 11, color: "#333", textAlign: "right", paddingRight: 6 }}>{value}</Text>
                  </View>
                );
              })}
            </View>

            {/* Chart area */}
            <View style={{ flex: 1, height, position: "relative" }}>
              {/* gridlines */}
              {Array.from({ length: ticks }).map((_, i) => {
                const top = (i / (ticks - 1)) * height;
                return <View key={i} style={{ position: "absolute", top, left: 0, right: 0, height: 1, backgroundColor: "#eee" }} />;
              })}

              {/* bars */}
              <View style={{ flexDirection: "row", width: "100%", height, justifyContent: "space-between" }}>
                {(() => {
                  const innerWidth = layoutWidth - yAxisWidth - outerPadding * 2;
                  const columnWidth = innerWidth / totalSlots;

                  // compute widths: both bars + gap occupy up to 70% of column
                  const maxTotalBarWidth = columnWidth * 0.7;
                  const barGap = Math.max(6, Math.min(14, columnWidth * 0.08));
                  const singleBarWidth = Math.max(12, Math.min(48, Math.floor((maxTotalBarWidth - barGap) / 2)));
                  const barsContainerWidth = singleBarWidth * 2 + barGap;

                  return data.map((d, i) => {
                    const loginsHeight = Math.round((d.logins / finalMax) * height);
                    const actionsHeight = Math.round((d.actions / finalMax) * height);

                    return (
                      <View key={i} style={{ width: columnWidth, alignItems: "center" }}>
                        <View style={{ height, justifyContent: "flex-end", alignItems: "center" }}>
                          <View style={{ width: barsContainerWidth, flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", height }}>
                            <TouchableOpacity activeOpacity={0.85} onPress={() => onBarPress(i, d.logins)}
                              style={{ width: singleBarWidth, height: loginsHeight, backgroundColor: loginsColor, borderTopLeftRadius: 4, borderTopRightRadius: 4 }} />
                            <TouchableOpacity activeOpacity={0.85} onPress={() => onBarPress(i, d.actions)}
                              style={{ width: singleBarWidth, height: actionsHeight, backgroundColor: actionsColor, borderTopLeftRadius: 4, borderTopRightRadius: 4 }} />
                          </View>
                        </View>

                        {/* label */}
                        <View style={{ width: columnWidth, alignItems: "center", marginTop: 6 }}>
                          <Text numberOfLines={1} ellipsizeMode="tail" style={{ fontSize: 12 }}>{d.label}</Text>
                        </View>
                      </View>
                    );
                  });
                })()}
              </View>

              {/* tooltip centered */}
              {active !== null && (
                <View style={{ position: "absolute", left: 0, top: 0, width: "100%", height, zIndex: 30, pointerEvents: "none" }}>
                  <CenteredTooltip active={active} layoutWidth={layoutWidth} yAxisWidth={44} outerPadding={12} tooltipWidth={tooltipWidth} setTooltipWidth={setTooltipWidth} maxTooltipWidth={200} height={height} data={data} loginsColor={"#154985"} />
                </View>
              )}
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

/* Centered tooltip helper */
function CenteredTooltip({ active, layoutWidth, yAxisWidth, outerPadding, tooltipWidth, setTooltipWidth, maxTooltipWidth, height, data, loginsColor }) {
  const innerWidth = layoutWidth - yAxisWidth - outerPadding * 2;
  const centerRelative = active.centerRelative;

  const desiredLeft = centerRelative - (tooltipWidth || maxTooltipWidth) / 2;
  const minLeft = 6;
  const maxLeft = Math.max(6, innerWidth - (tooltipWidth || maxTooltipWidth) - 6);
  const leftClamped = Math.max(minLeft, Math.min(desiredLeft, maxLeft));
  const topPos = Math.max(6, active.top - 54);

  return (
    <View style={{ position: "absolute", left: yAxisWidth, top: topPos, width: innerWidth }}>
      <View
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w && w !== tooltipWidth) setTooltipWidth(w);
        }}
        style={{ position: "absolute", left: leftClamped, backgroundColor: "#fff", paddingVertical: 6, paddingHorizontal: 8, borderRadius: 6, borderWidth: 1, borderColor: "#ccc", alignItems: "flex-start", maxWidth: maxTooltipWidth }}
      >
        <Text style={{ fontWeight: "700" }}>{data[active.index].label}</Text>
        <Text style={{ marginTop: 6 }}>Actions: {data[active.index].actions}</Text>
        <Text style={{ color: loginsColor, fontWeight: "700" }}>Logins: {data[active.index].logins}</Text>
      </View>
    </View>
  );
}

/* -------------------- ReportsTab -------------------- */
/* Shows generated views for System Overview, User Engagement, Performance Report */
function ReportsTab({ barData = [], metrics = [] }) {
  const [selected, setSelected] = useState(null); // null or title
  const [generatedAt, setGeneratedAt] = useState(null);
  const [pressedBtn, setPressedBtn] = useState(null); // <-- Add this state
  const [pressedTab, setPressedTab] = useState(null); // Add this state

  // warm demo values derived from props
  const totalUsers = metrics?.[0]?.value ?? 0;
  const activeUsers = metrics?.[1]?.value ?? 0;
  const totalLogins = barData.reduce((s, r) => s + (r.logins || 0), 0);
  const totalActions = barData.reduce((s, r) => s + (r.actions || 0), 0);

  // Demo values for engagement
  const newUsersDemo = 3;
  const inactiveUsers = Math.max(0, totalUsers - activeUsers - newUsersDemo);
  const avgLoginsPerUser = totalUsers > 0 ? (totalLogins / totalUsers).toFixed(1) : "0.0";

  // Performance demo values (you can replace with live metrics)
  const uptime = "99.8%";
  const avgResponseTime = "120ms";
  const peakUsage = "2:00 - 4:00 PM";
  const errorRate = "0.2%";

  const items = [
    { id: "system", title: "System Overview", desc: "Complete system usage and performance metrics" },
    { id: "engagement", title: "User Engagement", desc: "User activity and engagement analysis" },
    { id: "performance", title: "Performance Report", desc: "System Performance and uptime statistics" },
  ];

  const handleGenerate = (title) => {
    setSelected(title);
    setGeneratedAt(new Date());
  };

  const handleExportPdf = () => {
    Alert.alert("Export PDF", "PDF export is not implemented in this demo.");
  };

  const handleExportCsv = () => {
    Alert.alert("Export CSV", "CSV export is not implemented in this demo.");
  };

  const handleGenerateAnother = () => {
    setSelected(null);
    setGeneratedAt(null);
  };

  return (
    <View style={styles.reportsWrapper}>
      <View style={styles.reportsHeader}>
        <View style={{ marginRight: 8 }}>
          {/* Replaced the icon with a clearer DownloadBadge */}
          <DownloadBadge size={36} bg="transparent" iconColor="#000" />
        </View>
        <Text style={[styles.reportsTitle, { color: "#000" }]}>Generate Analytics Reports</Text>
      </View>

      {/* System Overview */}
      {selected === "System Overview" && (
        <View>
          <View style={styles.reportGeneratedCard}>
            <Text style={styles.reportGeneratedTitle}>Report Generated Successfully</Text>
            <Text style={styles.reportGeneratedTime}>{generatedAt ? generatedAt.toLocaleString() : ""}</Text>

            <View style={styles.reportRows}>
              <View style={styles.reportRow}>
                <Text style={styles.reportRowLabel}>Total Users:</Text>
                <Text style={styles.reportRowValue}>{String(totalUsers)}</Text>
              </View>

              <View style={styles.reportRow}>
                <Text style={styles.reportRowLabel}>Active Users:</Text>
                <Text style={styles.reportRowValue}>{String(activeUsers)}</Text>
              </View>

              <View style={styles.reportRow}>
                <Text style={styles.reportRowLabel}>Total Logins:</Text>
                <Text style={styles.reportRowValue}>{String(totalLogins)}</Text>
              </View>

              <View style={styles.reportRow}>
                <Text style={styles.reportRowLabel}>Total Actions:</Text>
                <Text style={styles.reportRowValue}>{String(totalActions)}</Text>
              </View>
            </View>
          </View>

          <View style={styles.exportButtonsRow}>
            <TouchableOpacity
              style={[
                styles.exportPdfButton,
                { backgroundColor: "#fff", borderColor: "#cbdff5", borderWidth: 1 }, // Match exportCsvButton border color
                pressedBtn === "pdf" && { backgroundColor: "#133E87", borderColor: "#133E87" }
              ]}
              activeOpacity={0.85}
              onPressIn={() => setPressedBtn("pdf")}
              onPressOut={() => setPressedBtn(null)}
              onPress={handleExportPdf}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <MaterialCommunityIcons name="file-pdf-box" size={16} color={pressedBtn === "pdf" ? "#fff" : "#000"} style={{ marginRight: 8 }} />
                <Text style={[
                  styles.exportPdfText,
                  { color: pressedBtn === "pdf" ? "#fff" : "#000" } // Black text by default, white when pressed
                ]}>
                  Export PDF
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.exportCsvButton,
                pressedBtn === "csv" && { backgroundColor: "#133E87", borderColor: "#133E87" }
              ]}
              activeOpacity={0.85}
              onPressIn={() => setPressedBtn("csv")}
              onPressOut={() => setPressedBtn(null)}
              onPress={handleExportCsv}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <TableIcon size={16} color={pressedBtn === "csv" ? "#fff" : "#000"} style={{ marginRight: 8 }} />
                <Text style={[
                  styles.exportCsvText,
                  pressedBtn === "csv" && { color: "#fff" }
                ]}>Export CSV</Text>
              </View>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[
              styles.generateAnotherButton,
              { borderColor: "#cbdff5", borderWidth: 1, backgroundColor: "#fff" }, // Default: white bg, blue border
              pressedBtn === "generateAnother" && { backgroundColor: "#133E87", borderColor: "#133E87" }
            ]}
            activeOpacity={0.85}
            onPressIn={() => setPressedBtn("generateAnother")}
            onPressOut={() => setPressedBtn(null)}
            onPress={handleGenerateAnother}
          >
            <Text style={[
              styles.generateAnotherText,
              { color: "#000" }, // Default black
              pressedBtn === "generateAnother" && { color: "#fff" } // White when pressed
            ]}>
              Generate Another Report
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* User Engagement */}
      {selected === "User Engagement" && (
        <View>
          <View style={styles.reportGeneratedCard}>
            <Text style={styles.reportGeneratedTitle}>Report Generated Successfully</Text>
            <Text style={styles.reportGeneratedTime}>{generatedAt ? generatedAt.toLocaleString() : ""}</Text>

            <View style={styles.reportRows}>
              <View style={styles.reportRow}>
                <Text style={styles.reportRowLabel}>New Users:</Text>
                <Text style={styles.reportRowValue}>{String(newUsersDemo)}</Text>
              </View>

              <View style={styles.reportRow}>
                <Text style={styles.reportRowLabel}>Active Users:</Text>
                <Text style={styles.reportRowValue}>{String(activeUsers)}</Text>
              </View>

              <View style={styles.reportRow}>
                <Text style={styles.reportRowLabel}>Inactive Users:</Text>
                <Text style={styles.reportRowValue}>{String(inactiveUsers)}</Text>
              </View>

              <View style={styles.reportRow}>
                <Text style={styles.reportRowLabel}>Avg Logins Per User:</Text>
                <Text style={styles.reportRowValue}>{avgLoginsPerUser}</Text>
              </View>
            </View>
          </View>

          <View style={styles.exportButtonsRow}>
            <TouchableOpacity
              style={[
                styles.exportPdfButton,
                { backgroundColor: "#fff", borderColor: "#cbdff5", borderWidth: 1 }, // Match exportCsvButton border color
                pressedBtn === "pdf" && { backgroundColor: "#133E87", borderColor: "#133E87" }
              ]}
              activeOpacity={0.85}
              onPressIn={() => setPressedBtn("pdf")}
              onPressOut={() => setPressedBtn(null)}
              onPress={handleExportPdf}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <MaterialCommunityIcons name="file-pdf-box" size={16} color={pressedBtn === "pdf" ? "#fff" : "#000"} style={{ marginRight: 8 }} />
                <Text style={[
                  styles.exportPdfText,
                  { color: pressedBtn === "pdf" ? "#fff" : "#000" } // Black text by default, white when pressed
                ]}>
                  Export PDF
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.exportCsvButton,
                pressedBtn === "csv" && { backgroundColor: "#133E87", borderColor: "#133E87" }
              ]}
              activeOpacity={0.85}
              onPressIn={() => setPressedBtn("csv")}
              onPressOut={() => setPressedBtn(null)}
              onPress={handleExportCsv}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <TableIcon size={16} color={pressedBtn === "csv" ? "#fff" : "#000"} style={{ marginRight: 8 }} />
                <Text style={[
                  styles.exportCsvText,
                  pressedBtn === "csv" && { color: "#fff" }
                ]}>Export CSV</Text>
              </View>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[
              styles.generateAnotherButton,
              { borderColor: "#cbdff5", borderWidth: 1, backgroundColor: "#fff" }, // Default: white bg, blue border
              pressedBtn === "generateAnother" && { backgroundColor: "#133E87", borderColor: "#133E87" }
            ]}
            activeOpacity={0.85}
            onPressIn={() => setPressedBtn("generateAnother")}
            onPressOut={() => setPressedBtn(null)}
            onPress={handleGenerateAnother}
          >
            <Text style={[
              styles.generateAnotherText,
              { color: "#000" }, // Default black
              pressedBtn === "generateAnother" && { color: "#fff" } // White when pressed
            ]}>
              Generate Another Report
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Performance Report */}
      {selected === "Performance Report" && (
        <View>
          <View style={styles.reportGeneratedCard}>
            <Text style={styles.reportGeneratedTitle}>Report Generated Successfully</Text>
            <Text style={styles.reportGeneratedTime}>{generatedAt ? generatedAt.toLocaleString() : ""}</Text>

            <View style={styles.reportRows}>
              <View style={styles.reportRow}>
                <Text style={styles.reportRowLabel}>Uptime:</Text>
                <Text style={styles.reportRowValue}>{uptime}</Text>
              </View>

              <View style={styles.reportRow}>
                <Text style={styles.reportRowLabel}>Avg Response Time:</Text>
                <Text style={styles.reportRowValue}>{avgResponseTime}</Text>
              </View>

              <View style={styles.reportRow}>
                <Text style={styles.reportRowLabel}>Peak Usage:</Text>
                <Text style={styles.reportRowValue}>{peakUsage}</Text>
              </View>

              <View style={styles.reportRow}>
                <Text style={styles.reportRowLabel}>Error Rate:</Text>
                <Text style={styles.reportRowValue}>{errorRate}</Text>
              </View>
            </View>
          </View>

          <View style={styles.exportButtonsRow}>
            <TouchableOpacity
              style={[
                styles.exportPdfButton,
                { backgroundColor: "#fff", borderColor: "#cbdff5", borderWidth: 1 }, // Match exportCsvButton border color
                pressedBtn === "pdf" && { backgroundColor: "#133E87", borderColor: "#133E87" }
              ]}
              activeOpacity={0.85}
              onPressIn={() => setPressedBtn("pdf")}
              onPressOut={() => setPressedBtn(null)}
              onPress={handleExportPdf}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <MaterialCommunityIcons name="file-pdf-box" size={16} color={pressedBtn === "pdf" ? "#fff" : "#000"} style={{ marginRight: 8 }} />
                <Text style={[
                  styles.exportPdfText,
                  { color: pressedBtn === "pdf" ? "#fff" : "#000" } // Black text by default, white when pressed
                ]}>
                  Export PDF
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.exportCsvButton,
                pressedBtn === "csv" && { backgroundColor: "#133E87", borderColor: "#133E87" }
              ]}
              activeOpacity={0.85}
              onPressIn={() => setPressedBtn("csv")}
              onPressOut={() => setPressedBtn(null)}
              onPress={handleExportCsv}
            >
              <View style={{ flexDirection: "row", alignItems: "center" }}>
                <TableIcon size={16} color={pressedBtn === "csv" ? "#fff" : "#000"} style={{ marginRight: 8 }} />
                <Text style={[
                  styles.exportCsvText,
                  pressedBtn === "csv" && { color: "#fff" }
                ]}>Export CSV</Text>
              </View>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[
              styles.generateAnotherButton,
              { borderColor: "#cbdff5", borderWidth: 1, backgroundColor: "#fff" }, // Default: white bg, blue border
              pressedBtn === "generateAnother" && { backgroundColor: "#133E87", borderColor: "#133E87" }
            ]}
            activeOpacity={0.85}
            onPressIn={() => setPressedBtn("generateAnother")}
            onPressOut={() => setPressedBtn(null)}
            onPress={handleGenerateAnother}
          >
            <Text style={[
              styles.generateAnotherText,
              { color: "#000" }, // Default black
              pressedBtn === "generateAnother" && { color: "#fff" } // White when pressed
            ]}>
              Generate Another Report
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Default list */}
      {selected === null && (
        <View style={styles.reportsList}>
          {items.map((it) => (
            <TouchableOpacity
              key={it.id}
              style={[
                styles.reportItem,
                pressedTab === it.id && { backgroundColor: "rgba(13,96,156,0.21)" } // #0D609C with 21% opacity
              ]}
              activeOpacity={0.85}
              onPressIn={() => setPressedTab(it.id)}
              onPressOut={() => setPressedTab(null)}
              onPress={() => handleGenerate(it.title)}
            >
              <Text style={styles.reportItemTitle}>{it.title}</Text>
              <Text style={styles.reportItemDesc}>{it.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

/* -------------------- Small helpers -------------------- */
function DateRangePicker({ selected, onChange, options = [] }) {
  const [open, setOpen] = useState(false);
  const [buttonLayout, setButtonLayout] = useState(null);

  return (
    <>
      <TouchableOpacity
        onPress={() => setOpen(true)}
        style={styles.rangeButton}
        activeOpacity={0.85}
        onLayout={(e) => setButtonLayout(e.nativeEvent.layout)}
      >
        <Text style={styles.rangeText}>{selected}</Text>
        <MaterialCommunityIcons name="chevron-down" size={16} color="#6b7280" />
      </TouchableOpacity>

      <Modal visible={open} transparent animationType="fade">
        <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setOpen(false)}>
          {buttonLayout && (
            <View style={{ position: "absolute", top: buttonLayout.y + buttonLayout.height, right: 16 }}>
              <View
                style={{
                  width: 160,
                  backgroundColor: "white",
                  borderRadius: 8,
                  paddingVertical: 6,
                  elevation: 4,
                  shadowColor: "#000",
                  shadowOpacity: 0.2,
                  shadowOffset: { width: 0, height: 2 },
                  shadowRadius: 4,
                }}
              >
                <FlatList
                  data={options}
                  keyExtractor={(i) => i}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.option}
                      onPress={() => {
                        onChange(item);
                        setOpen(false);
                      }}
                    >
                      <Text style={styles.dropdownOptionText}>{item}</Text>
                    </TouchableOpacity>
                  )}
                />
              </View>
            </View>
          )}
        </TouchableOpacity>
      </Modal>
    </>
  );
}

/* -------------------- MetricCard (only change: Active Sessions uses line-graph icon) -------------------- */
function MetricCard({ icon = "chart-line", title, value, subtitle }) {
  // Replace only the icons for Total Users and Active Sessions to match adminDashboard.js
  let iconName = icon;
  let extraTitleStyle = {};
  if (title === "Total Users" || title === "Active Sessions") {
    iconName = title === "Total Users" ? "account-group-outline" : "chart-timeline-variant";
    // Use the same font size as Total Users for Active Sessions
    extraTitleStyle = { marginLeft: -6, fontSize: 15 };
  }

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.iconCircle}>
          <MaterialCommunityIcons name={iconName} size={18} color="#154985" />
        </View>
        <Text
          style={[
            styles.cardTitle,
            { flexShrink: 1, flexGrow: 1, flexBasis: 0 },
            extraTitleStyle,
          ]}
          numberOfLines={1}
        >
          {title}
        </Text>
      </View>
      <Text style={styles.cardValue}>{String(value)}</Text>
      <Text style={styles.cardSubtitle}>{subtitle}</Text>
    </View>
  );
}

/* -------------------- Styles -------------------- */
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: "#ffff" },
  container: { padding: 16, alignItems: "center" },

  pickerRow: {
    width: "100%", backgroundColor: "#ffffff", borderRadius: 12, borderWidth: 1.5, borderColor: "#d9e9f6",
    padding: 14, flexDirection: "row", alignItems: "center", marginBottom: 16, justifyContent: "space-between",
  },
  pickerLabel: { fontSize: 16, color: "#0b2336" },

  rangeButton: {
    flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#a9c0d8",
    paddingVertical: 8, paddingHorizontal: 14, borderRadius: 12, backgroundColor: "#fff",
  },
  rangeText: { color: "#16324a", fontSize: 15, marginRight: 8 },
  rangeChevron: { color: "#6b7280" },

  metricsGrid: { width: "100%", flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginBottom: 18 },

  card: {
    width: "48%", backgroundColor: "#fff", borderRadius: 12, borderWidth: 1.2, borderColor: "#e1f0fb",
    padding: 14, marginBottom: 12, minHeight: 110, justifyContent: "space-between",
  },
  cardHeader: { flexDirection: "row", alignItems: "center", flexShrink: 1 },
  iconCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#eef6ff", alignItems: "center", justifyContent: "center", marginRight: 10 },
  icon: { fontSize: 18 },
  cardTitle: { fontSize: 16, color: "#0b2336", fontWeight: "600", flexShrink: 1 },
  cardValue: { fontSize: 34, color: "#000", fontWeight: "800", marginTop: 8 },
  cardSubtitle: { color: "#2a66a6", marginTop: 6, fontSize: 14 },

  // kept custom network icon styles (unused) in case you revert
  customNetworkIcon: { width: 22, alignItems: "center", justifyContent: "center" },
  iconRow: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
  node: { width: 6, height: 6, borderRadius: 6, backgroundColor: "#154985" },
  connector: { width: 8, height: 2.5, backgroundColor: "#154985", marginHorizontal: 3, borderRadius: 2 },
  connectorShort: { width: 6, height: 2.5, backgroundColor: "#154985", marginHorizontal: 3, borderRadius: 2 },

  chartCard: { backgroundColor: "#fff", borderRadius: 12, borderWidth: 1.2, borderColor: "#dbeffb", padding: 14, marginBottom: 18, width: "100%" },
  chartTitle: { fontSize: 18, fontWeight: "800", color: "#0b2336" },

  fallback: { paddingVertical: 18, alignItems: "center" },
  fallbackText: { color: "#b22222", fontWeight: "700" },
  fallbackTextSmall: { color: "#444", marginTop: 6, textAlign: "center" },
  instructions: { marginTop: 10, color: "#333", textAlign: "center", fontSize: 12, paddingHorizontal: 12 },

  tooltipWrapper: { position: "absolute", alignItems: "center", zIndex: 20, elevation: 10 },
  tooltipVerticalLine: { width: 2, backgroundColor: "#333", position: "absolute" },
  tooltipBox: { backgroundColor: "#fff", padding: 8, borderRadius: 6, borderWidth: 1, borderColor: "#ccc", marginBottom: 8, alignItems: "center" },
  tooltipLabel: { fontWeight: "700" },
  tooltipValue: { fontWeight: "700", color: "#154985" },

  // dropdown
  menu: { backgroundColor: "white", borderRadius: 10, paddingVertical: 8 },
  dropdownOptionText: { fontSize: 16, color: "#16324a" },
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.12)", justifyContent: "center", padding: 30 },
  option: { padding: 12 },

  // Reports tab
  reportsWrapper: { backgroundColor: "#eef6fb", borderRadius: 12, borderWidth: 1, borderColor: "#d6eaf8", padding: 16 },
  reportsHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  reportsIcon: { fontSize: 20, marginRight: 8 },
  reportsTitle: { fontSize: 18, fontWeight: "800", color: "#133E87", marginLeft: -7 },

  reportsList: { marginTop: 6 },
  reportItem: { backgroundColor: "#fff", borderRadius: 10, paddingVertical: 12, paddingHorizontal: 14, marginBottom: 10, borderWidth: 1, borderColor: "#d9eaf6" },
  reportItemActive: { backgroundColor: "#dfeefb", borderColor: "#bfe0fb" },
  reportItemTitle: { color: "#133E87", fontWeight: "700", marginBottom: 6 },
  reportItemTitleActive: { color: "#0b3b6a" },
  reportItemDesc: { color: "#556b82", fontSize: 13 },

  // Generated report card
  reportGeneratedCard: { backgroundColor: "#f3f8fc", borderRadius: 10, padding: 14, borderWidth: 1, borderColor: "#d6eaf8" },
  reportGeneratedTitle: { color: "#0b3b6a", fontSize: 16, fontWeight: "700", marginBottom: 6 },
  reportGeneratedTime: { color: "#556b82", marginBottom: 10 },

  reportRows: { marginTop: 6 },
  reportRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  reportRowLabel: { color: "#334e68" },
  reportRowValue: { color: "#000", fontWeight: "700" },

  // export buttons (centered)
  exportButtonsRow: { flexDirection: "row", justifyContent: "center", alignItems: "center", marginTop: 12 },
  exportPdfButton: {
    backgroundColor: "#fff", // Default white
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    marginRight: 12,
    borderWidth: 1,
    borderColor: "#cbdff5", // Match exportCsvButton border color
  },
  exportPdfText: {
    color: "#000", // Default black
    fontWeight: "700",
  },
  exportCsvButton: { backgroundColor: "#fff", paddingVertical: 12, paddingHorizontal: 18, borderRadius: 10, borderWidth: 1, borderColor: "#cbdff5" },
  exportCsvText: { color: "#000", fontWeight: "700" },

  generateAnotherButton: { backgroundColor: "#cfe9fb", paddingVertical: 12, borderRadius: 10, marginTop: 14, alignItems: "center" },
  generateAnotherText: { color: "#133E87", fontWeight: "700" },

  // Table icon helper style
  tableIconOuter: { position: "absolute", left: 0, top: 0, right: 0, bottom: 0, justifyContent: "center", alignItems: "center" },
});