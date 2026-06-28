#!/usr/bin/env python3
# Generate the two figures from REAL, sourced data.
import csv, statistics
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib import font_manager as fm
from matplotlib.colors import LinearSegmentedColormap, Normalize
from matplotlib.cm import ScalarMappable

plt.rcParams["font.family"] = "DejaVu Sans"
plt.rcParams["svg.fonttype"] = "none"

CSV = "france-berkeley-earth.csv"

# ---- Read Berkeley Earth monthly absolute temperature for France ----
monthly = {}  # year -> list of 12 monthly temps
with open(CSV) as f:
    for line in f:
        if line.startswith("#") or line.lower().startswith("year"):
            continue
        parts = line.strip().split(",")
        if len(parts) < 4:
            continue
        try:
            y = int(parts[0]); t = float(parts[3])
        except ValueError:
            continue
        monthly.setdefault(y, []).append(t)

# Annual means (only complete years with 12 months)
annual = {y: statistics.mean(v) for y, v in monthly.items() if len(v) == 12}

# Restrict to 1900-2020
years = [y for y in sorted(annual) if 1900 <= y <= 2020]
temps = [annual[y] for y in years]

# Anomaly vs 1961-1990 normal
ref = statistics.mean([annual[y] for y in range(1961, 1991)])
anom = [t - ref for t in temps]
print(f"1961-1990 mean absolute T (Berkeley, France) = {ref:.2f} C")
print(f"first years 1900-1909 mean anomaly = {statistics.mean(anom[:10]):+.2f}")
print(f"last decade 2011-2020 mean anomaly  = {statistics.mean(anom[-10:]):+.2f}")
print(f"2020 anomaly = {anom[-1]:+.2f}")

# 11-year centered moving average of anomalies
def movavg(xs, w=11):
    h = w // 2
    out = []
    for i in range(len(xs)):
        a = max(0, i - h); b = min(len(xs), i + h + 1)
        out.append(sum(xs[a:b]) / (b - a))
    return out
smooth = movavg(anom, 11)

# ---- Master chart: anomaly bars (cold->warm gradient) + trend line ----
cmap = LinearSegmentedColormap.from_list(
    "froid_chaud", ["#2166ac", "#73add0", "#f7f7d0", "#f4a582", "#d6604d", "#b2182b"])
vmax = max(abs(min(anom)), abs(max(anom)))
norm = Normalize(vmin=-vmax, vmax=vmax)

fig, ax = plt.subplots(figsize=(7.4, 2.72))
colors = [cmap(norm(a)) for a in anom]
ax.bar(years, anom, width=0.92, color=colors, linewidth=0)
ax.plot(years, smooth, color="#5a1414", lw=1.7, label="Moyenne glissante sur 11 ans")
ax.axhline(0, color="#444444", lw=0.8)

ax.set_xlim(1897, 2023)
ax.set_ylim(-1.6, 2.3)
ax.set_ylabel("Écart de température (°C)\npar rapport à 1961–1990", fontsize=8.5)
ax.set_yticks([-1, 0, 1, 2])
ax.set_yticklabels(["−1", "0", "+1", "+2"], fontsize=8)
ax.set_xticks([1900, 1920, 1940, 1960, 1980, 2000, 2020])
ax.tick_params(axis="x", labelsize=8)
for s in ["top", "right"]:
    ax.spines[s].set_visible(False)
ax.spines["left"].set_color("#888"); ax.spines["bottom"].set_color("#888")
ax.grid(axis="y", color="#dddddd", lw=0.6)
ax.set_axisbelow(True)

# annotate recent warmth
ax.annotate("Une décennie 2011–2020\nplus chaude de +1,3 °C\nque 1961–1990",
            xy=(2016, smooth[-5]), xytext=(1958, 1.75),
            fontsize=7.6, color="#5a1414",
            arrowprops=dict(arrowstyle="->", color="#5a1414", lw=0.9))
ax.legend(loc="upper left", fontsize=7.5, frameon=False)
fig.subplots_adjust(left=0.105, right=0.982, top=0.97, bottom=0.12)
fig.savefig("fig_temp.svg")
print("wrote fig_temp.svg")

# ---- Second chart: heatwave days per year (Météo-France) ----
fig2, ax2 = plt.subplots(figsize=(3.25, 2.15))
labels = ["Avant\n1989", "Depuis\n2000", "2015–2024"]
vals = [1.7, 8.0, 9.4]
bcol = ["#9ec6e0", "#e8916b", "#b2182b"]
bars = ax2.bar(labels, vals, color=bcol, width=0.66)
for b, v in zip(bars, vals):
    ax2.text(b.get_x() + b.get_width()/2, v + 0.25,
             f"{v:.1f}".replace(".", ","), ha="center", fontsize=8.5, fontweight="bold",
             color="#333")
ax2.set_ylim(0, 11)
ax2.set_ylabel("Jours de vague de chaleur\npar an (moyenne)", fontsize=8)
ax2.tick_params(axis="x", labelsize=8)
ax2.set_yticks([0, 5, 10]); ax2.tick_params(axis="y", labelsize=8)
for s in ["top", "right"]:
    ax2.spines[s].set_visible(False)
ax2.spines["left"].set_color("#888"); ax2.spines["bottom"].set_color("#888")
ax2.grid(axis="y", color="#e3e3e3", lw=0.6); ax2.set_axisbelow(True)
fig2.subplots_adjust(left=0.20, right=0.97, top=0.95, bottom=0.16)
fig2.savefig("fig_canicules.svg")
print("wrote fig_canicules.svg")
