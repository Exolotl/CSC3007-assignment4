// The code for the force graph function has been modified from the following website
// https://observablehq.com/@d3/force-directed-graph
// Copyright 2021 Observable, Inc.
// Released under the ISC license.

function ForceGraph({
    nodes, // an iterable of node objects (typically [{id}, …])
    links // an iterable of link objects (typically [{source, target}, …])
}, {
    nodeId = d => d.id, // given d in nodes, returns a unique identifier (string)
    nodeGroup, // given d in nodes, returns an (ordinal) value for color
    nodeGroups, // an array of ordinal values representing the node groups
    nodeTitle, // given d in nodes, a title string
    nodeFill = "currentColor", // node stroke fill (if not using a group color encoding)
    nodeStroke = "lightgray", // node stroke color
    nodeStrokeWidth = 2.5, // node stroke width, in pixels
    nodeStrokeOpacity = 1, // node stroke opacity
    nodeRadius = 15, // node radius, in pixels
    nodeStrength,
    linkSource = ({source}) => source, // given d in links, returns a node identifier string
    linkTarget = ({target}) => target, // given d in links, returns a node identifier string
    linkStroke = "#999", // link stroke color
    linkStrokeOpacity = 0.6, // link stroke opacity
    linkStrokeWidth = 2.5, // given d in links, returns a stroke width in pixels
    linkStrokeLinecap = "round", // link stroke linecap
    linkStrength,
    linkDistance = 60,
    colors = d3.schemeTableau10, // an array of color strings, for the node groups
    width = 1200, // outer width, in pixels
    height = 580, // outer height, in pixels
    invalidation // when this promise resolves, stop the simulation
} = {}) {

    // Compute values.
    const N = d3.map(nodes, nodeId).map(intern);
    const LS = d3.map(links, linkSource).map(intern);
    const LT = d3.map(links, linkTarget).map(intern);
    if (nodeTitle === undefined) nodeTitle = (_, i) => N[i];
    const T = nodeTitle == null ? null : d3.map(nodes, nodeTitle);
    const G = nodeGroup == null ? null : d3.map(nodes, nodeGroup).map(intern);
    const W = typeof linkStrokeWidth !== "function" ? null : d3.map(links, linkStrokeWidth);
    const L = typeof linkStroke !== "function" ? null : d3.map(links, linkStroke);

    // Replace the input nodes and links with mutable objects for the simulation.
    // nodes = d3.map(nodes, (_, i) => ({id: N[i]}));
    // links = d3.map(links, (_, i) => ({source: LS[i], target: LT[i]}));
    // console.log(nodes)
    // console.log(links)

    // Compute default domains.
    if (G && nodeGroups === undefined) nodeGroups = d3.sort(G);

    // Construct the scales.
    const color = nodeGroup == null ? null : d3.scaleOrdinal(nodeGroups, colors);

    // Construct the forces.
    const forceNode = d3.forceManyBody();
    const forceLink = d3.forceLink(links).id(({index: i}) => N[i]).distance(linkDistance);
    if (nodeStrength !== undefined) forceNode.strength(nodeStrength);
    if (linkStrength !== undefined) forceLink.strength(linkStrength);

    const simulation = d3.forceSimulation(nodes)
        .force("charge", forceNode)
        .force("link", forceLink)
        .force("center",  d3.forceCenter())
        .on("tick", ticked);
    
    const tooltip = d3.select(".tooltip")
        .style("opacity", 0)
        .style("background-color", "white")
        .style("border", "solid")
        .style("border-width", "2px")
        .style("border-radius", "5px")
        .style("padding", "5px")

    const svg = d3.select("#diagram")
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", [-width / 2, -height / 2, width, height])
        .attr("style", "max-width: 100%; height: auto; height: intrinsic;");

    
    // Create arrows for links
    let marker = svg.append("defs")
        .attr("class", "defs")
        .selectAll("marker")
        .data(links, function (d) { return d.source.id + "-" + d.target.id; });
    marker = marker
        .enter()
        .append("marker")
        .style("fill", "#000")
        .attr("id", function (d) { return (d.source.id + "-" + d.target.id).replace(/\s+/g, ''); })
        .style("opacity", function (d) { return Math.min(d.value, 1); })
        .attr("viewBox", "0 -5 10 10")
        .attr("refX", 22) 
        .attr("refY", 0)
        .attr("markerWidth", 5)
        .attr("markerHeight", 5)
        .attr("orient", "auto")
        .append("path")
        .attr("d", "M0,-5L10,0L0,5")
        .attr("fill", linkStroke)
        .merge(marker);

    const link = svg.append("g")
        .attr("stroke", typeof linkStroke !== "function" ? linkStroke : null)
        .attr("stroke-opacity", linkStrokeOpacity)
        .attr("stroke-width", typeof linkStrokeWidth !== "function" ? linkStrokeWidth : null)
        .attr("stroke-linecap", linkStrokeLinecap)
        .selectAll("line")
        .data(links)
        .join("line")
        .attr("marker-end", function(d) { return "url(#" + (d.source.id + "-" + d.target.id).replace(/\s+/g, '') + ")"; });

    const node = svg.append("g")
        .attr("fill", nodeFill)
        .attr("stroke", nodeStroke)
        .attr("stroke-opacity", nodeStrokeOpacity)
        .attr("stroke-width", nodeStrokeWidth)
        .selectAll("circle")
        .data(nodes)
        .join("circle")
        .attr("r", nodeRadius)
        .call(drag(simulation));

    if (W) link.attr("stroke-width", ({index: i}) => W[i]);
    if (L) link.attr("stroke", ({index: i}) => L[i]);
    if (G) node.attr("fill", ({index: i}) => color(G[i]));
    if (T) node.append("title").text(({index: i}) => T[i]);
    if (invalidation != null) invalidation.then(() => simulation.stop());

    node
        .on("mouseover", mouseover)
        .on("mousemove", mousemove)
        .on("mouseleave", mouseleave);

    // Filter duplicate nodes for legend
    const uniqueNode = nodeGroups.filter(onlyUnique);

    // Add one dot in the legend for each name.
    svg.selectAll("dots")
        .data(uniqueNode)
        .enter()
        .append("circle")
        .attr("cx", width/2 - 140)
        .attr("cy", function(d,i){ return 100 + i*25}) // 100 is where the first dot appears. 25 is the distance between dots
        .attr("r", 10)
        .style("stroke", "lightgray")
        .style('stroke-width', '0.5px')
        .style("fill", function(d){ return color(d)});

    // Add one dot in the legend for each name.
    svg.selectAll("labels")
        .data(uniqueNode)
        .enter()
        .append("text")
        .attr("x", width/2 - 120)
        .attr("y", function(d,i){ return 100 + i*25}) // 100 is where the first dot appears. 25 is the distance between dots
        .style("fill", function(d){ return color(d)})
        .text(function(d){ return d})
        .style("stroke", "gray")
        .style('stroke-width', '0.5px')
        .attr("text-anchor", "left")
        .style("alignment-baseline", "middle");

    function intern(value) {
        return value !== null && typeof value === "object" ? value.valueOf() : value;
    }

    function ticked() {
        link
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);

        node
        .attr("cx", d => d.x)
        .attr("cy", d => d.y);
    }

    function drag(simulation) {    
        function dragstarted(event) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            event.subject.fx = event.subject.x;
            event.subject.fy = event.subject.y;
        }
        
        function dragged(event) {
            event.subject.fx = event.x;
            event.subject.fy = event.y;
        }
        
        function dragended(event) {
            if (!event.active) simulation.alphaTarget(0);
            event.subject.fx = null;
            event.subject.fy = null;
        }
        
        return d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended);
    }

    function mouseover(d) {
        tooltip
            .style("display", "block")
            .style("opacity", 0.9);
        d3.select(this)
            .transition()
            .style("stroke", "black")
            .style("opacity", 0.6)
            .style('stroke-width', nodeStrokeWidth+"px");
    }

    function mousemove(event, d) {
        tooltip
            .html(
                d.id + "<br>" + 
                capitalizeFirstLetter(d.gender) + "<br>" + 
                capitalizeFirstLetter(d.occupation) + "<br>" + 
                capitalizeFirstLetter(d.organization) + "<br>" +
                "Vaccination: " + capitalizeFirstLetter(d.vaccinated)
            ) 
            .style("position", "absolute")
            .style("top", (event.pageY - 15)+"px")
            .style("left",(event.pageX + 15)+"px");
    }

    function mouseleave(d) {
        tooltip
            .style("opacity", 0)
            .style("display", "none");
        d3.select(this)
            .transition()
            .style("stroke", nodeStroke)
            .style("opacity", nodeStrokeOpacity)
            .style("stroke-width", nodeStrokeWidth+"px");
    }
        
    return Object.assign(svg.node(), {scales: {color}});
}

// For capitalizing sentences
function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

// For removing duplicates in array
function onlyUnique(value, index, self) {
    return self.indexOf(value) === index;
}

Promise.all([d3.json("links.json"), d3.json("cases.json")]).then(data => {

    // Data preprocessing
    data[0].forEach(e => {
        e.source = e.infector;
        e.target = e.infectee;
    });
        
    console.log(data); //links
    console.log(data[1]); //cases

    ForceGraph({
        nodes: data[1],
        links: data[0] },
    {
        nodeId: d => d.id,
        nodeGroup: d => d.gender,
        colors: ["violet", "cyan", "#32CD32"]
        // nodeTitle: d => `${d.id}\n${d.gender}`,
        // linkSource: ({source}) => source, // given d in links, returns a node identifier string
        // linkTarget: ({target}) => target, // given d in links, returns a node identifier string
    })

    d3.select("#btGender").on("click", function() {
        d3.select("svg").remove();
        ForceGraph({
            nodes: data[1],
            links: data[0] },
        {
            nodeId: d => d.id,
            nodeGroup: d => d.gender,
            colors: ["violet", "cyan", "#32CD32"]
            // nodeTitle: d => `${d.id}\n${d.gender}`,
            // linkSource: ({source}) => source, // given d in links, returns a node identifier string
            // linkTarget: ({target}) => target, // given d in links, returns a node identifier string
        })
    });

    d3.select("#btVaccination").on("click", function() {
        d3.select("svg").remove();
        ForceGraph({
            nodes: data[1],
            links: data[0] },
        {
            nodeId: d => d.id,
            nodeGroup: d => d.vaccinated,
            colors: ["#F45B69", "#00A6ED", "#7FB800"]
            // nodeTitle: d => `${d.id}\n${d.gender}`,
            // linkSource: ({source}) => source, // given d in links, returns a node identifier string
            // linkTarget: ({target}) => target, // given d in links, returns a node identifier string
        })
    });
    
})