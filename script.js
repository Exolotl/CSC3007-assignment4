let width = 1200;
let height = 580;

//let margin = {top: 20, right: 20, bottom: 20, left: 20};
let margin = 20;

let map = d3.select("#mapArea")
.append("svg")
.attr("preserveAspectRatio", "xMinYMin meet")
.attr("viewBox", "0 0 " + width + " " + height);

Promise.all([d3.json("links-sample.json"), d3.json("cases-sample.json")]).then(data => {

    // Data preprocessing
    data[0].forEach(e => {
        e.source = e.infector;
        e.target = e.infectee;
    });
        
    console.log(data[0]); //links
    console.log(data[1]); //cases

    
    
})