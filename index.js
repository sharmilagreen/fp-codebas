// Mothitor antenna data vis tab options:
const SEASONS = {
    spring: ["Apr", "May"],
    summer: ["Jun", "Jul", "Aug"],
    fall:   ["Sep", "Oct"]
};
 
const ALL_MONTHS = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"];
const DEPLOYMENTS = ["SYD", "AMA", "CAR"];
 
let state = {
    displayMode: "species",
    activeMonths: new Set(ALL_MONTHS),
    highlightedGroup: null,
    hideSingletons: false           
};
 
// color codes for species groups
const COLOR_PALETTE = [
    "#6baed6","#2ca25f","#756bb1","#fd8d3c","#e377c2","#17becf",
    "#bcbd22","#9467bd","#8c564b","#e7ba52","#cedb9c","#9edae5",
    "#637939","#843c39","#5254a3","#6b6ecf","#b5cf6b","#d6616b",
    "#ce6dbd","#de9ed6","#3182bd","#31a354","#e6550d","#756bb1",
    "#636363","#a1d99b","#fdae6b","#9ecae1","#bcbddc","#bdbdbd"
];
 
let colorMap = {};  
 
function getGlobalStats(allRecords) {
    const filtered = allRecords.filter(d => state.activeMonths.has(d.month));
    const totalCount = d3.sum(filtered, d => d.count) || 0;
    
    d3.select("#global-avg-display")
      .text(`Global Total: ${totalCount} detections`);
    
    return totalCount;
}
 
function getColor(name) {
    if (!colorMap[name]) {
        const idx = Object.keys(colorMap).length % COLOR_PALETTE.length;
        colorMap[name] = COLOR_PALETTE[idx];
    }
    return colorMap[name];
}
 
// loading data
d3.json("mothitor_antenna_data_2025.json").then(rawData => {
 
    // summing by species/genus/family, group by month and deployment for display
    const aggMap = new Map();
 
    rawData.forEach(item => {
        if (item.determination.name === "Not Lepidoptera") return;
 
        const taxon   = item.determination_details.taxon;
        const parents = Object.fromEntries(
            (taxon.parents || []).map(p => [p.rank, p.name])         
        );
        const genus   = parents["GENUS"]  || (taxon.rank === "GENUS"  ? taxon.name : "Unknown");
        const family  = parents["FAMILY"] || (taxon.rank === "FAMILY" ? taxon.name : "Unknown");
        const species = taxon.name;
        const month   = item.event.date_label.split(" ")[0];
        const dep     = item.deployment.name;
        const count   = item.detections_count || 1;

        // Compute pixel area from bbox if available
        let bboxArea = null;
        if (item.detections && item.detections.length > 0) {
            const bbox = item.detections[0].bbox;
            if (bbox && bbox.length === 4) {
                const area = (bbox[2] - bbox[0]) * (bbox[3] - bbox[1]);
                if (area > 0) bboxArea = area;
            }
        }        
 
        const key = `${dep}|${month}|${species}`;
        if (!aggMap.has(key)) {
            aggMap.set(key, { dep, month, species, genus, family, count: 0, bboxAreas: [] });
        }
        const entry = aggMap.get(key);
        entry.count += count;
        if (bboxArea !== null) entry.bboxAreas.push(bboxArea);
    });
 
    const allRecords = Array.from(aggMap.values());
 
    // setting colors for species
    const allSpecies = [...new Set(allRecords.map(d => d.species))].sort();
    allSpecies.forEach(s => getColor(s));
 
    renderBoards(allRecords);
    renderLegend(allRecords);
    setupControls(allRecords);
    updateStatusHeader();
 
    d3.select("body").append("div").attr("id", "tooltip");
 
}).catch(err => {
    document.body.innerHTML += `<p style="color:red">Error loading data: ${err}</p>`;
});

//headers for current month/year/etc.
function updateStatusHeader() {
    const months = [...state.activeMonths].sort((a, b) =>
        ALL_MONTHS.indexOf(a) - ALL_MONTHS.indexOf(b)
    );
    const monthStr = months.length === ALL_MONTHS.length ? "All months" : months.join(", ");
    const modeStr = state.displayMode.charAt(0).toUpperCase() + state.displayMode.slice(1);
    const singletonStr = state.hideSingletons ? "  ·  hiding singletons" : "";
    d3.select("#status-header")
        .text(`Viewing by ${modeStr}  ·  ${monthStr}${singletonStr}`);
}
 
// creating boards for vis
function renderBoards(allRecords) {
    const container = d3.select("#boards");
    container.selectAll(".board-card").remove();
 
    DEPLOYMENTS.forEach(dep => {
        const card = container.append("div")
            .attr("class", "board-card")
            .attr("id", `board-${dep}`);
 
        card.append("div").attr("class", "board-title").text(`Mothitor — ${dep}`);
        card.append("div").attr("class", "board-subtitle").text("Total detections / taxon  ·  click dot for name");
        card.append("div").attr("class", "board-svg-container").attr("id", `svg-container-${dep}`);
        card.append("div").attr("class", "board-biomass").attr("id", `biomass-${dep}`);
    });
 
    updateBoards(allRecords);
}
 
function updateBoards(allRecords) {
    const globalMax = computeGlobalMax(allRecords);
    DEPLOYMENTS.forEach(dep => {
        drawBoard(dep, allRecords, globalMax);
    });
}

function getFilteredRecords(allRecords) {
    return allRecords.filter(d => {
        if (!state.activeMonths.has(d.month)) return false;
        if (state.hideSingletons && d.count <= 1) return false;
        return true;
    });
}

function computeGlobalMax(allRecords) {
    const filtered = getFilteredRecords(allRecords);
    let globalMax = 0;
    DEPLOYMENTS.forEach(dep => {
        const records = filtered.filter(d => d.dep === dep);
        const groupKey = d => d[state.displayMode];
        const groupMap = d3.rollup(records, v => d3.sum(v, d => d.count), groupKey);
        const groups = Array.from(groupMap, ([name, total]) => ({ name, total }));
        const depMax = d3.max(groups, d => d.total) || 0;
        if (depMax > globalMax) globalMax = depMax;
    });
    return globalMax;    
}
 
function drawBoard(dep, allRecords) {
    const container = d3.select(`#svg-container-${dep}`);
    container.selectAll("*").remove();
    const filtered = getFilteredRecords(allRecords);
    const records = filtered.filter(d => d.dep === dep);

 
    const groupKey = d => d[state.displayMode];
 
    const groupMap = d3.rollup(records, v => d3.sum(v, d => d.count), groupKey);
    const groups = Array.from(groupMap, ([name, total]) => ({ name, total }))
                        .sort((a, b) => b.total - a.total);

    // biomass/avg bbox pixel area
    const allAreas = records.flatMap(d => d.bboxAreas);
    const avgBiomass = allAreas.length > 0 ? d3.mean(allAreas) : null;
    d3.select(`#biomass-${dep}`)
        .text(avgBiomass !== null
            ? `Avg biomass: ${Math.round(avgBiomass).toLocaleString()} px²`
            : "Avg biomass: N/A");
            
            
    if (groups.length === 0) {
        container.append("p").style("color", "#aaa").style("font-size", "0.8rem")
            .text("No data for selected filters.");
        return;
    }
 
    // box dimensions
    const W = 340, H = 320;
    const margin = { top: 16, right: 20, bottom: 40, left: 56 };
    const innerW = W - margin.left - margin.right;
    const innerH = H - margin.top - margin.bottom;
 
    const svg = container.append("svg")
        .attr("viewBox", `0 0 ${W} ${H}`)
        .attr("preserveAspectRatio", "xMidYMid meet");
 
    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);
 
    // scales
    const maxTot = d3.max(groups, d => d.total);
    const yScale = d3.scaleLinear()
        .domain([0, globalMax * 1.1])
        .range([innerH, 0])
        .nice();
    const xScale = d3.scaleBand()
        .domain(groups.map(d => d.name))
        .range([0, innerW])
        .padding(0.5);
 
    // y axis
    g.append("g")
        .attr("class", "axis")
        .call(d3.axisLeft(yScale).ticks(5).tickSize(-innerW))
        .call(ax => ax.select(".domain").remove())
        .call(ax => ax.selectAll(".tick line").attr("stroke", "#eee"));
 
    g.append("text")
        .attr("transform", "rotate(-90)")
        .attr("y", -margin.left + 10)
        .attr("x", -innerH / 2)
        .attr("text-anchor", "middle")
        .attr("font-size", "10px")
        .attr("fill", "#888")
        .text("Total detections / taxon");
 
    const deploymentMean = d3.mean(groups, d => d.total);
 
    // Mean line
    g.append("line")
        .attr("x1", 0)
        .attr("x2", innerW)
        .attr("y1", yScale(deploymentMean))
        .attr("y2", yScale(deploymentMean))
        .attr("stroke", "#ff7f0e")
        .attr("stroke-width", 1.5)
        .attr("stroke-dasharray", "4,2")
        .style("opacity", 0.7);
 
    // label for the mean line
    g.append("text")
        .attr("x", innerW)
        .attr("y", yScale(deploymentMean) - 5)
        .attr("text-anchor", "end")
        .attr("fill", "#ff7f0e")
        .style("font-size", "9px")
        .style("font-weight", "bold")
        .text(`AVG: ${deploymentMean.toFixed(1)}`);
 
    // Dots
    const tooltip = d3.select("#tooltip");
 
    g.selectAll(".dot")
        .data(groups)
        .join("circle")
        .attr("class", "dot")
        .attr("cx", d => xScale(d.name) + xScale.bandwidth() / 2)
        .attr("cy", d => yScale(d.total))
        .attr("r", d => Math.max(4, Math.min(14, 4 + d.total * 0.8)))
        .attr("fill", d => getGroupColor(d.name))
        .attr("opacity", d => dotOpacity(d.name))
        .on("mousemove", (event, d) => {
            tooltip
                .style("display", "block")
                .style("left", (event.clientX + 14) + "px")
                .style("top",  (event.clientY - 28) + "px")
                .html(`<strong>${d.name}</strong><br>Total detections: ${d.total}`);
        })
        .on("mouseleave", () => {
            tooltip.style("display", "none");
        });
 
    // x label
    g.append("text")
        .attr("x", innerW / 2)
        .attr("y", innerH + 30)
        .attr("text-anchor", "middle")
        .attr("font-size", "10px")
        .attr("fill", "#999")
        .text(`${groups.length} taxa shown`);
}
 
// color assignment for groups (species/genus/family)
const groupColorCache = {};
 
function getGroupColor(name) {
    if (!groupColorCache[name]) {
        const idx = Object.keys(groupColorCache).length % COLOR_PALETTE.length;
        groupColorCache[name] = COLOR_PALETTE[idx];
    }
    return groupColorCache[name];
}
 
function dotOpacity(name) {
    if (!state.highlightedGroup) return 0.85;
    return name === state.highlightedGroup ? 1 : 0.15;
}
 
// legend
function renderLegend(allRecords) {
    updateLegend(allRecords);
}
 
function updateLegend(allRecords) {
    const legendEl = d3.select("#legend");
    legendEl.selectAll("*").remove();
 
    const filteredRecords = allRecords.filter(d => state.activeMonths.has(d.month));
    
    const visibleNames = [...new Set(filteredRecords.map(d => d[state.displayMode]))].sort();
 
    legendEl.append("div")
        .attr("class", "legend-title")
        .text(`Key — ${state.displayMode} (${visibleNames.length} total)`);
 
    const list = legendEl.append("div")
        .attr("class", "legend-list")
        .style("display", "grid")
        .style("grid-template-columns", "repeat(6, 1fr)") 
        .style("gap", "4px 20px")
        .style("max-height", "300px")
        .style("overflow-y", "auto")
        .style("margin-top", "10px");
 
    const items = list.selectAll(".legend-item")
        .data(visibleNames)
        .enter()
        .append("div")
        .attr("class", "legend-item")
        .style("display", "flex")
        .style("align-items", "center")
        .style("margin-bottom", "4px")
        .style("cursor", "pointer")
        .on("mouseenter", (event, name) => {
            state.highlightedGroup = name;
            refreshDots();
        })
        .on("mouseleave", () => {
            state.highlightedGroup = null;
            refreshDots();
        });
 
    items.append("div")
        .style("width", "12px")
        .style("height", "12px")
        .style("border-radius", "2px")
        .style("margin-right", "8px")
        .style("background-color", d => getGroupColor(d));
 
    items.append("span")
        .style("font-size", "12px")
        .style("color", "#444")
        .text(d => {
            // Total for this taxon across active months/deployments
            const taxonTotal = d3.sum(filteredRecords.filter(r => r[state.displayMode] === d), r => r.count);
            return `${d} (${taxonTotal})`;
        });
}
 
function getGroupCount(allRecords) {
    const filteredRecords = allRecords.filter(d => state.activeMonths.has(d.month));
    return new Set(filteredRecords.map(d => d[state.displayMode])).size;
}
 
function refreshDots() {
    d3.selectAll(".dot")
        .attr("opacity", d => dotOpacity(d.name));
}
 
// controls
function setupControls(allRecords) {
 
    // display mode buttons
    d3.selectAll("#display-buttons .toggle-btn").on("click", function () {
        state.displayMode = d3.select(this).attr("data-display");
        d3.selectAll("#display-buttons .toggle-btn").classed("active", false);
        d3.select(this).classed("active", true);
        state.highlightedGroup = null;
        // color reset
        Object.keys(groupColorCache).forEach(k => delete groupColorCache[k]);
        updateBoards(allRecords);
        updateLegend(allRecords);
        updateStatusHeader();
    });


    // one-count filter button
    d3.select("#singleton-btn").on("click", function () {
        state.hideSingletons = !state.hideSingletons;
        d3.select(this).classed("active", state.hideSingletons);
        updateBoards(allRecords);
        updateLegend(allRecords);
        updateStatusHeader();
    });
 
    // month buttons
    d3.selectAll("#month-buttons .toggle-btn").on("click", function () {
        const month = d3.select(this).attr("data-month");
                
        const isActive = d3.select(this).classed("active") && state.activeMonths.size === 1;
        
        if (isActive) {
            d3.select(this).classed("active", false);
            state.activeMonths = new Set(ALL_MONTHS);
        } else {
            state.activeMonths.clear();
            state.activeMonths.add(month);
            d3.selectAll("#month-buttons .toggle-btn").classed("active", false);
            d3.select(this).classed("active", true);
        }
        
        d3.selectAll(".season-btn").classed("active", false);
        d3.selectAll("#month-buttons .toggle-btn").classed("active", 
            function() { return state.activeMonths.has(d3.select(this).attr("data-month"));}
        );
        
        updateBoards(allRecords);
        updateLegend(allRecords);
        updateStatusHeader();
    });
 
    // season buttons
    d3.selectAll(".season-btn").on("click", function () {
        const season = d3.select(this).attr("data-season");
 
        const isActive = d3.select(this).classed("active");
        if (isActive) {
            d3.select(this).classed("active", false);
            state.activeMonths = new Set(ALL_MONTHS);
        } else {
            d3.selectAll(".season-btn").classed("active", false);
            d3.select(this).classed("active", true);
            state.activeMonths = new Set(SEASONS[season]);
        }
 
        d3.selectAll("#month-buttons .toggle-btn").classed("active",
            function () { return state.activeMonths.has(d3.select(this).attr("data-month")); }
        );
 
        updateBoards(allRecords);
        updateLegend(allRecords);
        updateStatusHeader();
    });
}
