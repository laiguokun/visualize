/*
 * The JS is not "robust" and non-obfuscated :-)
 */

var start = 0;



var GC = {

  /* default message */

  /* Stores the name of the dataset */
  datakey : "csxml" , 

  /* The function that should be called first , load the database 
   * and renders the the root node i.e. node 0 
   */

  load : function() {
    var URL = document.URL;
    var tmp = URL.split("&");
    var starta = 0,startb = 0;
    if (tmp.length > 1)
      if (tmp[1].split("=")[0] = "GC_NODEA")
        starta = tmp[1].split("=")[1];
    if (tmp.length > 2)
      if (tmp[2].split("=")[0] = "GC_NODEB")
        startb = tmp[2].split("=")[1];
    if (starta != 0)
      GC.Node.search_wordA(starta);
    if (startb != 0)
      GC.Node.search_wordB(startb);
  },

  /*********************************************************************
   * Holds the hierarchy of the given dataset. It is loaded when calling
   * calling the GC.load function. It stays until load is called again.
   **********************************************************************/


  Hierarchy : (function(){
    var Hierarchy = new Object();

    Hierarchy.data = null;
    Hierarchy.parent = null;

    /* Sets the Hierarchy information to match the input data */

    Hierarchy.set_data = function (_data)  {
      Hierarchy.data = _data;
      Hierarchy.parent = new Object();

      for ( var key in _data ) {
	       var p = key;
	       for ( var i = 0; i < _data[key].length; ++i )
	       Hierarchy.parent[ _data[key][i] ] = p;
      } 
    }

    /* Return true if the given node is a leaf-node */

    Hierarchy.is_leaf = function (n) {
      return Hierarchy.data[n] == undefined;
    }

    /* Returns parent of given node [-1 for root node] */

    Hierarchy.get_parent = function (n) {
      if ( n == 0 ) return -1;
      return Hierarchy.parent[n];
    }

    /* On receiving hierarchy data - set it and load the root node */

    Hierarchy.on_load = function (s) {
      Hierarchy.set_data( JSON.parse(s) ); 
    }

    /* Load the hierarchy data, call 'on_load' once data is received */

    Hierarchy.load = function () {
      GC.GetValueFromServer({type:"hierarchy"} , this.on_load );
    }
    return Hierarchy;
  }()) ,


  /**********************************************************************
   * Format of AJAX request to server .
   * value = {type: "hierarchy"}  
   *         | 
   *         {type: "content" | "children", 
   *          node: <node-id>}
   **********************************************************************/


  FormRequest : function ( value ) {
    var loc = "/GC";
    var req = loc + "?GC_DATASET=" + this.datakey;
    if ( value.type == "hierarchy" )
      req += "&GC_REQ=hierarchy";
    else if ( value.type == "content" )
      req += "&GC_REQ=content&GC_NODE=" + value.node;
    else if ( value.type == "children" )
      req += "&GC_REQ=children&GC_NODE=" + value.node;
    else if ( value.type == "timeLine" )
      req += "&GC_REQ=timeLine&GC_NODE=" + value.node;
    else if ( value.type == "searchNode")
      req += "&GC_REQ=searchNode&GC_NODE=" + value.node;
    else if ( value.type == 'buildsubtree')
      req += "&GC_REQ=buildsubtree&GC_NODE=" + value.node;
    else if ( value.type == 'buildsubtreeoftwoword')
      req += "&GC_REQ=buildsubtreeoftwoword&GC_NODEA=" + value.nodeA +"&GC_NODEB=" +value.nodeB;
    else if ( value.type == 'changeTreeNode')
      req += "&GC_REQ=changeTreeNode&GC_NODE=" + value.node;
    return req;
  } , 



  /**********************************************************************
   * Send the AJAX request to server and call 'func' when data is recieved
   **********************************************************************/


  GetValueFromServer : function ( value , func , arg ) {
    var url = GC.FormRequest(value);
    /* If you are old IE 5,6,7 - Please die ! , dont use the web */
    var xm = new XMLHttpRequest();
    xm.onreadystatechange = function () {
      if ( xm.readyState == 4 && xm.status == 200 )
	func ( xm.responseText , arg );
    }
    xm.open('get' , url , true );
    xm.send();
  } ,

  /* Holds all the information of the current node being displayed */

  Node : (function(){
    var NodeA = null;
    var NodeB = null;
    var keyA = null;
    var keyB = null;
    var dataA = null;
    var dataB = null;
    var wordA = "null";
    var wordB = "null";
    Node.showWord = function(s)
    {
      Node.graphics.render_wordseries(JSON.parse(Node.dataA.ws[s]),JSON.parse(Node.dataB.ws[s]));
    }
    Node.loadA = function(n){
      GC.GetValueFromServer({type:"timeLine",node:n}, Node.on_load_timelineA);
      var ha = document.getElementById("a-h-super");
      ha.href = "http://bonda.lti.cs.cmu.edu:8003/gc.html&GC_NODE=" + n;
      ha.text = "hierarchy";
      var ts = document.getElementById("a-t-super");
      ts.href = "http://bonda.lti.cs.cmu.edu:8003/ts.html&GC_NODE=" + n;
      ts.text = "time_series";


    }

    Node.on_load_timelineA = function(s){
      var dataset = (JSON.parse(s));
      if (Node.dataA == undefined){
        Node.dataA = new Object();
      }
      Node.dataA.normal = JSON.parse(dataset[0]);//normal
      Node.dataA.r0 = JSON.parse(dataset[1]);//r0
      Node.dataA.rp= JSON.parse(dataset[2]);//rp
      Node.dataA.rt = JSON.parse(dataset[3]);//rt
      Node.dataA.ws = JSON.parse(dataset[4]);//ws
      Node.ws = Node.dataA.ws;
      Node.graphics.render_timeLine(Node.dataA, Node.dataB, Node.keyA, Node.keyB);
    }    

    Node.searchA = function(){
      var s = document.getElementById("set-word-A").value;
      Node.search_wordA(s);
    }

    Node.search_wordA = function(s){
      Node.wordA = s;
      GC.GetValueFromServer({type:"searchNode", node:s}, Node.search_nodeA)
    }
    Node.search_nodeA = function(s){
      var data = JSON.parse(s);
      var search_node = data.result;
      Node.keyA = search_node;
      Node.loadA(search_node);
      Node.update_tree();
    }

    Node.loadB = function(n){
      GC.GetValueFromServer({type:"timeLine",node:n}, Node.on_load_timelineB);
      var ha = document.getElementById("b-h-super");
      ha.href = "http://bonda.lti.cs.cmu.edu:8003/gc.html&GC_NODE=" + n;
      ha.text = "hierarchy";
      var ts = document.getElementById("b-t-super");
      ts.href = "http://bonda.lti.cs.cmu.edu:8003/ts.html&GC_NODE=" + n;
      ts.text = "time_series";
    }

    Node.on_load_timelineB = function(s){
      var dataset = (JSON.parse(s));
      if (Node.dataB == undefined){
        Node.dataB = new Object();
      }
      Node.dataB.normal = JSON.parse(dataset[0]);//normal
      Node.dataB.r0 = JSON.parse(dataset[1]);//r0
      Node.dataB.rp= JSON.parse(dataset[2]);//rp
      Node.dataB.rt = JSON.parse(dataset[3]);//rt
      Node.dataB.ws = JSON.parse(dataset[4]);//ws
      Node.graphics.render_timeLine(Node.dataA, Node.dataB, Node.keyA, Node.keyB);
    }    

    Node.searchB = function(){
      var s = document.getElementById("set-word-B").value;
      Node.search_wordB(s);
    }

    Node.search_wordB = function(s){
      Node.wordB = s;
      GC.GetValueFromServer({type:"searchNode", node:s}, Node.search_nodeB)
    }
    Node.search_nodeB = function(s){
      var data = JSON.parse(s);
      var search_node = data.result;
      Node.keyB = search_node;
      Node.loadB(search_node);
      Node.update_tree();
    }

    Node.update_tree = function()
    {
      if (Node.wordA == undefined) Node.wordA = "nonewordforthis";
      if (Node.wordB == undefined) Node.wordB = "nonewordforthis";
      GC.GetValueFromServer({type:"buildsubtreeoftwoword", nodeA:Node.wordA, nodeB:Node.wordB}, Node.getsubtree)
    }

    Node.getsubtree = function(s)
    {
      Node.tree = JSON.parse(s);
      Node.keyA = Node.tree.nodeA;
      Node.keyB = Node.tree.nodeB;
      Node.graphics.render_tree(Node.tree);
    }

    Node.treeclick = function(d)
    {
      if (d.set == 1)
      {
        Node.keyA = d.nodeId;
        Node.loadA(Node.keyA);
        GC.GetValueFromServer({type:"changeTreeNode", node:"A"+Node.keyA}, Node.changeTreeNode);
      }
      if (d.set == 2)
      {
        Node.keyB = d.nodeId;
        Node.loadB(Node.keyB);
        GC.GetValueFromServer({type:"changeTreeNode", node:"B"+Node.keyB}, Node.changeTreeNode);
      }
    }
    Node.changeTreeNode = function(s)
    {
      Node.tree = JSON.parse(s);
      Node.graphics.render_tree(Node.tree);
    }

    Node.graphics = (function(){

      var gx = new Object();

      /* Setup the d3.js parameters and data */

      gx.d3data = null;
      var tw = 400;
      var th = 200;
      var padding = 50;

      gx.timedata = [];
      gx.timedatar0 = [];
      gx.timedatarp = [];
      gx.timedataws = [];

      gx.timedataB = [];
      gx.timedatar0B = [];
      gx.timedatarpB = [];
      gx.timedatawsB = [];

      gx.xMarks = [];
      gx.xMarksws = [];
      gx.grow_rate = null;
      gx.format = d3.format(",d");

      /* Define the circle-circle pack layout */

      gx.pack = d3.layout.pack()
	       .size([ gx.diameter-4 , gx.diameter-4 ])
	       .padding(5)
	       .value(function(d) { return d.size; });
      gx.urladd = null;   
      /* SVG Container for all the display elements */

      gx.container = null;
      gx.timesvg = null;
      gx.xScale = null;
      gx.yScale = null;
      gx.xAxis = null;
      gx.xBar = null;
      gx.yBar = null;
      gx.line = null;
      gx.path = null;
      gx.pathB = null;
      gx.timesvgr0 = null;
      gx.xScaler0 = null;
      gx.yScaler0 = null;
      gx.xAxisr0 = null;
      gx.xBarr0 = null;
      gx.yBarr0 = null;
      gx.liner0 = null;
      gx.pathr0 = null;
      gx.pathr0B = null;

      gx.timesvgrp = null;
      gx.xScalerp = null;
      gx.yScalerp = null;
      gx.xAxisrp = null;
      gx.xBarrp = null;
      gx.yBarrp = null;
      gx.linerp = null;
      gx.pathrp = null;
      gx.pathrpB = null;

      gx.timesvgws = null;
      gx.xScalews = null;
      gx.yScalews = null;
      gx.xAxisws = null;
      gx.xBarws = null;
      gx.yBarws = null;
      gx.linews = null;
      gx.pathws = null;
      gx.pathwsB = null;

      gx.treesvg = null;
      gx.tree = null;
      gx.diagonal = null;
      gx.treeData = null;
      var wmargin = 20;
      var hmargin = 70;
      gx.root = null;
      gx.nodes = null;
      gx.node = null;
      gx.nodeEnter = null;
      gx.nodeUpdate = null;
      gx.link = null;
      gx.cnt = null;
      gx.root = null;
      gx.grad = null;

      /* Add a svg element to the left-page. Well, you can put this in the html
       * as well. Add 'filters' to the svg object. Currently the only filter is
       * the 'shadow' filter which appears as a 'hover' on the circles.
       */

      (function setup_graphics(){
        //initialize the tree
        var w = document.documentElement.clientWidth*0.9*0.6;
        var h = document.documentElement.clientHeight*0.9;
        gx.tree = d3.layout.tree()
        .size([w-2*wmargin, h-2*hmargin]);

        gx.diagonal = d3.svg.diagonal()
          .projection(function(d) { return [d.x, d.y]; });

        gx.treesvg = d3.select("#graph-part").append("svg")
        .attr("width", w)
        .attr("height", h*1.2)
        .append("g")
        .attr("transform", "translate(" + wmargin + "," + hmargin + ")");

//        gx.grad = gx.treesvg.append("defs").append("linearGradient").attr("id", "grad")
//                  .attr("x1", "0%").attr("x2", "100%").attr("y1", "0%").attr("y2", "0%");
//        gx.grad.append("stop").attr("offset", "50%").style("stop-color", "blue");
//        gx.grad.append("stop").attr("offset", "50%").style("stop-color", "purple");

        gx.timesvg = d3.select("#wordbox")
        .append("svg")
        .attr("width",tw)
        .attr("height",th);
        gx.timesvg.append("g")
        .append("rect")
        .attr("x",0)
        .attr("y",0)
        .attr("width",tw)
        .attr("height",th)
        .style("fill","#FFF")
        .style("stroke-width",2)
        .style("stroke","#E7E7E7");

        gx.timesvg.append("text")
        .attr("x", (tw / 2))             
        .attr("y", (padding / 2))
        .attr("text-anchor", "middle")  
        .style("font-size", "16px") 
        .text("the number of papers vs year");

        gx.xScale = d3.scale.linear()
          .domain([0,gx.xMarks.length-1])
          .range([padding,tw-padding]);
        gx.yScale = d3.scale.linear()
          .domain([0,Math.max(d3.max(gx.timedata), d3.max(gx.timedataB))])
          .range([th-padding,padding]);
        gx.xAxis = d3.svg.axis()
          .scale(gx.xScale)  
          .orient("bottom").ticks(gx.xMarks.length);
        
        //添加横坐标轴并通过编号获取对应的横轴标签
        gx.xBar=gx.timesvg.append("g")
          .attr("class", "axis")
          .attr("transform", "translate(0," + (th - padding) + ")")
          .call(gx.xAxis)
        gx.xBar.selectAll("text")
          .text(function(d){return gx.xMarks[d];});
        
        //定义纵轴
        gx.yAxis = d3.svg.axis()
          .scale(gx.yScale)
          .orient("left").ticks(7);

        //添加纵轴
        gx.yBar=gx.timesvg.append("g")
            .attr("class", "axis")
            .attr("transform", "translate("+padding+",0)")
            .call(gx.yAxis);     
        
        //添加折线
        gx.line = d3.svg.line()
          .interpolate("monotone")
          .x(function(d,i){return gx.xScale(i);})
          .y(function(d){return gx.yScale(d);});
        
        gx.path=gx.timesvg.append("path")
          .attr("d", gx.line(gx.timedata))
          .style("fill","#F00")
          .style("fill","none")
          .style("stroke-width",1)
          .style("stroke","red")
          .style("stroke-opacity",0.9);

        gx.pathB=gx.timesvg.append("path")
          .attr("d",gx.line(gx.timedataB))
          .style("fill","#00F")
          .style("fill","none")
          .style("stroke-width",1)
          .style("stroke","blue")
          .style("stroke-opacity",0.9);

        //添加系列的小圆点
        gx.timesvg.selectAll("circle")
        .data(gx.timedata)
        .enter()
        .append("a")
        .attr("xlink:href", "http://www.google.com")
        .append("circle")
        .attr("cx", function(d,i) {
            return gx.xScale(i);
        })  
        .attr("cy", function(d) {
            return gx.yScale(d);  
        })  
        .style("fill", "#FFF")
        .attr("r",5);

        //rate to 0 box;
        gx.timesvgr0 = d3.select("#rateto0box")
        .append("svg")
        .attr("width",tw)
        .attr("height",th);
        gx.timesvgr0.append("g")
        .append("rect")
        .attr("x",0)
        .attr("y",0)
        .attr("width",tw)
        .attr("height",th)
        .style("fill","#FFF")
        .style("stroke-width",2)
        .style("stroke","#E7E7E7");

        gx.timesvgr0.append("text")
        .attr("x", (tw / 2))             
        .attr("y", (padding / 2))
        .attr("text-anchor", "middle")  
        .style("font-size", "12px") 
        .text("the papers number's rate to whole dataset vs years");

        gx.xScaler0 = d3.scale.linear()
          .domain([0,gx.xMarks.length-1])
          .range([padding,tw-padding]);
        gx.yScaler0 = d3.scale.linear()
          .domain([0,d3.max(gx.timedatar0)])
          .range([th-padding,padding]);
        gx.xAxisr0 = d3.svg.axis()
          .scale(gx.xScaler0)  
          .orient("bottom").ticks(gx.xMarks.length); 
        //添加横坐标轴并通过编号获取对应的横轴标签
        gx.xBarr0=gx.timesvgr0.append("g")
          .attr("class", "axis")
          .attr("transform", "translate(0," + (th - padding) + ")")
          .call(gx.xAxisr0);
        gx.xBarr0.selectAll("text")
          .text(function(d){return gx.xMarks[d];});
        
        //定义纵轴
        gx.yAxisr0 = d3.svg.axis()
          .scale(gx.yScaler0)
          .orient("left").ticks(7);

        //添加纵轴
        gx.yBarr0=gx.timesvgr0.append("g")
            .attr("class", "axis")
            .attr("transform", "translate("+padding+",0)")
            .call(gx.yAxisr0);     
        
        //添加折线
        gx.liner0 = d3.svg.line()
          .interpolate("monotone")
          .x(function(d,i){return gx.xScaler0(i);})
          .y(function(d){return gx.yScaler0(d);});
        
        gx.pathr0 = gx.timesvgr0.append("path")
          .attr("d", gx.liner0(gx.timedatar0))
          .style("fill","#F00")
          .style("fill","none")
          .style("stroke-width",1)
          .style("stroke","#F00")
          .style("stroke-opacity",0.9);
        gx.pathr0B=gx.timesvgr0.append("path")
          .attr("d",gx.line(gx.timedatar0B))
          .style("fill","#00F")
          .style("fill","none")
          .style("stroke-width",1)
          .style("stroke","blue")
          .style("stroke-opacity",0.9);
        //添加系列的小圆点
        gx.timesvgr0.selectAll("circle")
        .data(gx.timedatar0)
        .enter()
        .append("a")
        .attr("xlink:href", "http://www.google.com")
        .append("circle")
        .attr("cx", function(d,i) {
            return gx.xScaler0(i);
        })  
        .attr("cy", function(d) {
            return gx.yScaler0(d);  
        })  
        .attr("r",5);
        //rate to parent
        gx.timesvgrp = d3.select("#ratetoparentbox")
        .append("svg")
        .attr("width",tw)
        .attr("height",th);
        gx.timesvgrp.append("g")
        .append("rect")
        .attr("x",0)
        .attr("y",0)
        .attr("width",tw)
        .attr("height",th)
        .style("fill","#FFF")
        .style("stroke-width",2)
        .style("stroke","#E7E7E7");

       gx.timesvgrp.append("text")
        .attr("x", (tw / 2))             
        .attr("y", (padding / 2))
        .attr("text-anchor", "middle")  
        .style("font-size", "12px") 
        .text("the papers number's rate to parent vs years");
        gx.xScalerp = d3.scale.linear()
          .domain([0,gx.xMarks.length-1])
          .range([padding,tw-padding]);
        gx.yScalerp = d3.scale.linear()
          .domain([0,d3.max(gx.timedatarp)])
          .range([th-padding,padding]);
        gx.xAxisrp = d3.svg.axis()
          .scale(gx.xScalerp)  
          .orient("bottom").ticks(gx.xMarks.length); 
        //添加横坐标轴并通过编号获取对应的横轴标签
        gx.xBarrp=gx.timesvgrp.append("g")
          .attr("class", "axis")
          .attr("transform", "translate(0," + (th - padding) + ")")
          .call(gx.xAxisrp);
        gx.xBarrp.selectAll("text")
          .text(function(d){return gx.xMarks[d];});
        
        //定义纵轴
        gx.yAxisrp = d3.svg.axis()
          .scale(gx.yScalerp)
          .orient("left").ticks(7);

        //添加纵轴
        gx.yBarrp=gx.timesvgrp.append("g")
            .attr("class", "axis")
            .attr("transform", "translate("+padding+",0)")
            .call(gx.yAxisrp);     
        
        //添加折线
        gx.linerp = d3.svg.line()
          .interpolate("monotone")
          .x(function(d,i){return gx.xScalerp(i);})
          .y(function(d){return gx.yScalerp(d);});
        
        gx.pathrp = gx.timesvgrp.append("path")
          .attr("d", gx.linerp(gx.timedatar0))
          .style("fill","#F00")
          .style("fill","none")
          .style("stroke-width",1)
          .style("stroke","#F00")
          .style("stroke-opacity",0.9);

        gx.pathrpB=gx.timesvgrp.append("path")
          .attr("d",gx.line(gx.timedatarpB))
          .style("fill","#00F")
          .style("fill","none")
          .style("stroke-width",1)
          .style("stroke","blue")
          .style("stroke-opacity",0.9);
        //添加系列的小圆点
        gx.timesvgrp.selectAll("circle")
        .data(gx.timedatarp)
        .enter()
        .append("a")
        .attr("xlink:href", "http://www.google.com")
        .append("circle")
        .attr("cx", function(d,i) {
            return gx.xScalerp(i);
        })  
        .attr("cy", function(d) {
            return gx.yScalerp(d);  
        })  
        .attr("r",5);
        //graph to show word series
        gx.timesvgws = d3.select("#wordseriesgraphbox")
        .append("svg")
        .attr("width",tw)
        .attr("height",th);
        gx.timesvgws.append("g")
        .append("rect")
        .attr("x",0)
        .attr("y",0)
        .attr("width",tw)
        .attr("height",th)
        .style("fill","#FFF")
        .style("stroke-width",2)
        .style("stroke","#E7E7E7");
        gx.timesvgws.append("text")
        .attr("x", (tw / 2))             
        .attr("y", (padding / 2))
        .attr("text-anchor", "middle")  
        .style("font-size", "12px") 
        .text("the position of word in current topic vs years");
        gx.xScalews = d3.scale.linear()
          .domain([0,gx.xMarksws.length-1])
          .range([padding,tw-padding]);
        gx.yScalews = d3.scale.linear()
          .domain([0,d3.max(gx.timedataws)])
          .range([th-padding,padding]);
        gx.xAxisws = d3.svg.axis()
          .scale(gx.xScalews)  
          .orient("bottom").ticks(gx.xMarksws.length); 
        //添加横坐标轴并通过编号获取对应的横轴标签
        gx.xBarws=gx.timesvgws.append("g")
          .attr("class", "axis")
          .attr("transform", "translate(0," + (th - padding) + ")")
          .call(gx.xAxisws);
        gx.xBarws.selectAll("text")
          .text(function(d){return gx.xMarksws[d];});
        
        //定义纵轴
        gx.yAxisws = d3.svg.axis()
          .scale(gx.yScalews)
          .orient("left").ticks(7);

        //添加纵轴
        gx.yBarws=gx.timesvgws.append("g")
            .attr("class", "axis")
            .attr("transform", "translate("+padding+",0)")
            .call(gx.yAxisws);     
        
        //添加折线
        gx.linews = d3.svg.line()
          .interpolate("monotone")
          .x(function(d,i){return gx.xScalews(i);})
          .y(function(d){return gx.yScalews(d);});
        
        gx.pathws = gx.timesvgws.append("path")
          .attr("d", gx.linews(gx.timedataws))
          .style("fill","#F00")
          .style("fill","none")
          .style("stroke-width",1)
          .style("stroke","#F00")
          .style("stroke-opacity",0.9);

        gx.pathwsB=gx.timesvgws.append("path")
          .attr("d",gx.linews(gx.timedatawsB))
          .style("fill","#00F")
          .style("fill","none")
          .style("stroke-width",1)
          .style("stroke","blue")
          .style("stroke-opacity",0.9);
        //添加系列的小圆点
        gx.timesvgws.selectAll("circle")
        .data(gx.timedataws)
        .enter()
        .append("a")
        .attr("xlink:href", "http://www.google.com")
        .append("circle")
        .attr("cx", function(d,i) {
            return gx.xScalews(i);
        })  
        .attr("cy", function(d) {
            return gx.yScalews(d);  
        })  
        .attr("r",5);
      }());


      /* The 'core' non-leaf node rendering function using d3js */


      gx.render_timeLine = function(DATA_A, DATA_B, nodeidA, nodeidB)
      {
        var padding = 20;
        var th = 200;
        var tw = 400;
        var oldData = gx.timedata;var oldDatar0 = gx.timedatar0;var oldDatarp = gx.timedatarp;
        var oldDataB = gx.timedataB;var oldDatarpB = gx.timedatarpB;var oldDatar0B = gx.timedatar0B;
        gx.timedata = [];gx.timedatar0 = [];gx.timedatarp = [];
        gx.timedataB = [];gx.timedatar0B = [];gx.timedatarpB = [];
        gx.xMarks = [];
        var cnt = 0;var l1 = 0;var l2 = 0;
        for (var year = 1994; year <= 2004; year ++)
        {
          if ((year-1994) % 2 ==0)
          {
            gx.xMarks.push(year);
            cnt += 1;
          }
          else
            gx.xMarks.push(" ");
        }
        if (DATA_A != undefined)
        {
          var data = DATA_A.normal;
          var datar0 = DATA_A.r0;
          var datarp = DATA_A.rp;
          for (var year = 1994; year <= 2004; year ++)
          {
            gx.timedata.push(parseInt(data[year]));
            gx.timedatar0.push(parseFloat(datar0[year]));
            gx.timedatarp.push(parseFloat(datarp[year]));
          }
        }
        else
          for (var year = 1994; year <= 2004; year ++)
          {
            gx.timedata.push(0);
            gx.timedatar0.push(0);
            gx.timedatarp.push(0);
          }
        if (DATA_B != undefined)
        {
          var dataB = DATA_B.normal;
          var datar0B = DATA_B.r0;
          var datarpB = DATA_B.rp;
          for (var year = 1994; year <= 2004; year ++)
          {
            gx.timedataB.push(parseInt(dataB[year]));
            gx.timedatar0B.push(parseFloat(datar0B[year]));
            gx.timedatarpB.push(parseFloat(datarpB[year]));
          }
        }
        else
          for (var year = 1994; year <= 2004; year ++)
          {
            gx.timedataB.push(0);
            gx.timedatar0B.push(0);
            gx.timedatarpB.push(0);
          }
        var urltmp = "http://bonda.lti.cs.cmu.edu/mfhdt/html/all/"
        if (gx.urladd == undefined)
          gx.urladd = new Array();
        if (nodeidA == undefined)
          gx.urladd[0] = "";
        else
          gx.urladd[0] = urltmp + "node=" + nodeidA.toString() + ".flat=0.time=" ;
        if (nodeidB == undefined)
          gx.urladd[1] = "";
        else
          gx.urladd[1] = urltmp + "node=" + nodeidB.toString() + ".flat=0.time=" ;
        var newLength = gx.xMarks.length;
        var _duration = 1000;
        //render sum box
        oldData = oldData.concat(oldDataB);
        var circle = gx.timesvg.selectAll("circle").data(oldData);
        circle.exit().remove();

        gx.xScale.domain([0,newLength - 1]);   
        gx.xAxis.scale(gx.xScale).ticks(cnt);
        gx.xBar.transition().duration(_duration).call(gx.xAxis);
        gx.xBar.selectAll("text").text(function(d){return gx.xMarks[d];});
        gx.yScale.domain([0,Math.max(d3.max(gx.timedata),d3.max(gx.timedataB))]);       
        gx.yBar.transition().duration(_duration).call(gx.yAxis);
        gx.path.transition().duration(_duration).attr("d",gx.line(gx.timedata));
        gx.pathB.transition().duration(_duration).attr("d",gx.line(gx.timedataB));
        //重绘4圆点 

        gx.timesvg.selectAll("circle")
        .data(gx.timedata.concat(gx.timedataB))
        .enter()
        .append("circle")
        .attr("cx", function(d,i){
          if(i>=oldData.length) return tw-padding; return gx.xScale(i % gx.timedata.length);
        })  
        .attr("cy",function(d,i){
          if(i>=oldData.length) return th-padding; return gx.yScale(d);
        })
        .style("fill","#000")
        .on("click", function(d, i) { 
          window.open( gx.urladd[Math.floor(i / gx.timedata.length).toString()] + (1995+(i % gx.timedata.length)).toString() + '.html'); 
        }) 

        gx.timesvg.selectAll("circle")
        .attr("r",5)
        gx.timesvg.selectAll("circle")   
        .transition()
        .duration(_duration)
        .attr("cx", function(d,i) {       
            return gx.xScale(i % gx.timedata.length);
        })  
        .attr("cy", function(d) {
            return gx.yScale(d);  
        });

        //render r0 box
        oldDatar0 = oldDatar0.concat(oldDatar0B);
        var circler0 = gx.timesvgr0.selectAll("circle").data(oldDatar0);
        circler0.exit().remove();
        gx.xScaler0.domain([0,newLength - 1]);   
        gx.xAxisr0.scale(gx.xScaler0).ticks(cnt);
        gx.xBarr0.transition().duration(_duration).call(gx.xAxisr0);
        gx.xBarr0.selectAll("text").text(function(d){return gx.xMarks[d];});
        gx.yScaler0.domain([0,Math.max(d3.max(gx.timedatar0B),d3.max(gx.timedatar0))]);       
        gx.yBarr0.transition().duration(_duration).call(gx.yAxisr0);
        gx.pathr0.transition().duration(_duration).attr("d",gx.liner0(gx.timedatar0));
        gx.pathr0B.transition().duration(_duration).attr("d",gx.liner0(gx.timedatar0B));
        //重绘4圆点 
        gx.timesvgr0.selectAll("circle")
        .data(gx.timedatar0.concat(gx.timedatar0B))
        .enter()
        .append("circle")
        .attr("cx", function(d,i){
          if(i>=oldDatar0.length) return tw-padding; return gx.xScaler0(i % gx.timedata.length);
        })  
        .attr("cy",function(d,i){
          if(i>=oldDatar0.length) return th-padding; return gx.yScaler0(d);
        })
        .style("fill","#000")
        .on("click", function(d, i) { 
          window.open(gx.urladd[Math.floor(i / gx.timedata.length).toString()] + (1995+(i % gx.timedata.length)).toString() + '.html'); 
        })

        gx.timesvgr0.selectAll("circle")
        .attr("r",5)    
        
        gx.timesvgr0.selectAll("circle")   
        .transition()
        .duration(_duration)
        .attr("cx", function(d,i) {       
            return gx.xScaler0(i % gx.timedata.length);
        })  
        .attr("cy", function(d) {
            return gx.yScaler0(d);  
        });
        //rate to parent
        oldDatarp = oldDatarp.concat(oldDatarpB);
        var circlerp = gx.timesvgrp.selectAll("circle").data(oldDatarp);
        circlerp.exit().remove();
        gx.xScalerp.domain([0,newLength - 1]);   
        gx.xAxisrp.scale(gx.xScalerp).ticks(cnt);
        gx.xBarrp.transition().duration(_duration).call(gx.xAxisrp);
        gx.xBarrp.selectAll("text").text(function(d){return gx.xMarks[d];});
        gx.yScalerp.domain([0,Math.max(d3.max(gx.timedatarpB),d3.max(gx.timedatarp))]);       
        gx.yBarrp.transition().duration(_duration).call(gx.yAxisrp);
        gx.pathrp.transition().duration(_duration).attr("d",gx.linerp(gx.timedatarp));
        gx.pathrpB.transition().duration(_duration).attr("d",gx.linerp(gx.timedatarpB));
        //重绘4圆点 
        gx.timesvgrp.selectAll("circle")
        .data(gx.timedatarp.concat(gx.timedatarpB))
        .enter()
        .append("circle")
        .attr("cx", function(d,i){
          if(i>=oldData.length) return tw-padding; return gx.xScalerp(i % gx.timedata.length);
        })  
        .attr("cy",function(d,i){
          if(i>=oldData.length) return th-padding; return gx.yScalerp(d);
        })
        .style("fill","#000")
        .on("click", function(d, i) { 
          window.open(gx.urladd[Math.floor(i / gx.timedata.length).toString()] + (1995+(i % gx.timedata.length)).toString() + '.html'); 
        })

        gx.timesvgrp.selectAll("circle")
        .attr("r",5)    
        gx.timesvgrp.selectAll("circle")   
        .transition()
        .duration(_duration)
        .attr("cx", function(d,i) {       
            return gx.xScalerp(i % gx.timedata.length);
        })  
        .attr("cy", function(d) {
            return gx.yScalerp(d);  
        });
        var datawsA = new Array();
        var datawsB = new Array();
        if (DATA_A != undefined) datawsA = Object.keys(DATA_A.ws);
        if (DATA_B != undefined) datawsB = Object.keys(DATA_B.ws);
        var wordset = new Array();
        for (var i = 0; i < datawsA.length; i++)
          for (var j = 0; j < datawsB.length; j++)
            if (datawsA[i] == datawsB[j])
            {
              wordset.push(datawsA[i]);
              break;
            }
        var wsnode = document.getElementById("wordselect");
        while (wsnode.hasChildNodes())
        {
          wsnode.removeChild(wsnode.firstChild);
        }
        for (var i = 0; i < wordset.length; i++)
        {
          var node = document.createElement("option");
          node.value = wordset[i];
          if (i==0) Node.showWord(wordset[i]);
          var textnode = document.createTextNode(wordset[i]);
          node.appendChild(textnode);
          wsnode.appendChild(node);
        }
      }

      gx.render_wordseries = function (dataA, dataB)
      {
        var padding = 20;
        var th = 200;
        var tw = 400;
        var oldData = gx.timedataws;
        var oldDataB = gx.timedatawsB;
        gx.timedataws = [];
        gx.timedatawsB = [];
        gx.xMarksws = []
        var cnt = 0;
        for (var year = 1994; year <= 2004; year ++)
        {
          var tmp = parseInt(dataA[year]);
          if (tmp == 0)
            gx.timedataws.push(0);
          else
            gx.timedataws.push(1.0/tmp);
          var tmp = parseInt(dataB[year]);
          if (tmp == 0)
            gx.timedatawsB.push(0);
          else
            gx.timedatawsB.push(1.0/tmp);
          if ((year-1994) % 2 ==0)
          {
            gx.xMarksws.push(year);
            cnt += 1;
          }
          else
            gx.xMarksws.push(" ");
        }
        var newLength = gx.timedataws.length;
        var _duration = 1000;
        //render sum box
        oldData = oldData.concat(oldDataB);
        var circle = gx.timesvgws.selectAll("circle").data(oldData);
        circle.exit().remove();
        gx.xScalews.domain([0,newLength - 1]);   
        gx.xAxisws.scale(gx.xScalews).ticks(cnt);
        gx.xBarws.transition().duration(_duration).call(gx.xAxisws);
        gx.xBarws.selectAll("text").text(function(d){return gx.xMarksws[d];});
        gx.yScalews.domain([0,Math.max(d3.max(gx.timedatawsB),d3.max(gx.timedataws))]);       
        gx.yBarws.transition().duration(_duration).call(gx.yAxisws);
        gx.pathws.transition().duration(_duration).attr("d",gx.linews(gx.timedataws));
        gx.pathwsB.transition().duration(_duration).attr("d",gx.linews(gx.timedatawsB));
        //重绘4圆点 

        gx.timesvgws.selectAll("circle")
        .data(gx.timedataws.concat(gx.timedatawsB))
        .enter()
        .append("circle")
        .attr("cx", function(d,i){
          if(i>=oldData.length) return tw-padding; return gx.xScalews(i % gx.timedata.length);
        })  
        .attr("cy",function(d,i){
          if(i>=oldData.length) return th-padding; return gx.yScalews(d);
        })
        .style("fill","#000")
        .on("click", function(d, i) { 
          window.open(gx.urladd[Math.floor(i / gx.timedata.length).toString()] + (1995+(i % gx.timedata.length)).toString() + '.html'); 
        })

        gx.timesvgws.selectAll("circle")
        .attr("r",5)     
        gx.timesvgws.selectAll("circle")   
        .transition()
        .duration(_duration)
        .attr("cx", function(d,i) {       
            return gx.xScalews(i % gx.timedataws.length);
        })  
        .attr("cy", function(d) {
            return gx.yScalews(d);  
        });
      }   
      gx.render_tree = function(root)
      {
        gx.root = root;
        var w = document.documentElement.clientWidth*0.95*0.6;
        var h = document.documentElement.clientHeight*0.9;
        root.x0 = w/2;
        root.y0 = 0;
        var duration = 750;
        gx.cnt = 0;
        gx.treesvg.selectAll("*").remove();
        gx.nodes = gx.tree.nodes(gx.root).reverse();
        gx.links = gx.tree.links(gx.nodes);
        gx.node = gx.treesvg.selectAll("g.node")
                  .data(gx.nodes, function(d){return d.id || (d.id = ++gx.cnt);});
        gx.nodeEnter = gx.node.enter().append("g")
                      .attr("class","node")
                      .attr("transform", function(d) {return "translate(" + root.x0 + "," + root.y0 + ")";});
        

        var grad = gx.treesvg.append("defs").append("linearGradient").attr("id", "grad")
                    .attr("x1", "0%").attr("x2", "100%").attr("y1", "0%").attr("y2", "0%");
        grad.append("stop").attr("offset", "50%").style("stop-color", "purple");
        grad.append("stop").attr("offset", "50%").style("stop-color", "blue");
        gx.nodeEnter.append("circle")
        .attr("r", function(d){
          if (d.mark == 1) return 20;
          else return 7;
        })
        .style("stroke", function(d)
        {
          if (d.nodeId == Node.keyA || d.nodeId == Node.keyB)
            return "red";
          else
            return "steelblue";
        })
        .style("fill", function(d){
          if (d.set == 1) return "blue";
          if (d.set == 2) return "purple";
          if (d.set == 4) return "url(#grad)";
          return "grey";

        })
        .on("click", Node.treeclick);
        gx.nodeEnter
        .append("title").text(function(d){ return d.desc.join(", ")});
        gx.nodeEnter.append("text")
        .attr("y", function(d){ if (d.mark == 1) return d.children ? -60:40;
          else
            return d.children ? -50:20})
        .attr("dy",".35em")
        .attr("text-anchor", function(d){return "middle"})
        .text(function(d){return d.desc.join(' ')})
        .style("fill-opacity",1e-6);

        var insertLinebreaks = function (d) {
          var el = d3.select(this);
          var words = d.desc;
          el.text('');

          for (var i = 0; i < Math.min(3, words.length); i++) {
              var tspan = el.append('tspan').text(words[i]);
              if (i > 0)
                  tspan.attr('x', 0).attr('dy', '15');
          }
        };

        gx.nodeEnter.selectAll("text").each(insertLinebreaks);

        gx.nodeUpdate = gx.node.transition()
                        .duration(duration)
                        .attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")";});
        gx.nodeUpdate.select("text")
        .style("fill-opacity", 1);
        gx.link = gx.treesvg.selectAll("path.link")
        .data(gx.links, function(d) { return d.target.id;});
        gx.link.enter().insert("path", "g")
        .attr("class", "link")
        .attr("d", function(d){
          var o = {x: root.x0, y: root.y0};
          return gx.diagonal({source: o, target: o});
        });
        gx.link.transition()
        .duration(duration)
        .attr("d", gx.diagonal);
      }
      /* End of graphics object */
      return gx;
    }());

    /* End of Node object */
    return Node;
  }()) , 


  /* **********************************************************************
   * General set of Utility function.
   *       1. Camel case conversion
   *       2. Hook keys to a function
   * **********************************************************************/


  utils : (function(){
    var utils = new Object();

    utils.keytofunc = {};

    utils.camel_case = function (s) {
      return s.charAt(0).toUpperCase() + s.slice(1);
    };

    /* Helper functions to hook keys to function */

    utils.hookescape = function (func) {
      utils.keytofunc[27] = func;
      
    };

    utils.hooknext = function (func) {
      utils.keytofunc[39] = func;
    }

    utils.hookprev = function (func) {
      utils.keytofunc[37] = func;
    }

    utils.unhookall = function () {
      utils.keytofunc = {};
    }

    /* Initialize (whicher does not depend on GC) */
    window.onkeypress = function (event) {
      var e = event.keyCode || event.which;
      if ( utils.keytofunc[e] ) utils.keytofunc[e](e);
    }

    document.onkeydown = function (event) {
      var e = event.keyCode || event.which;
      if ( utils.keytofunc[e] ) utils.keytofunc[e](e);
    }

    utils.hookescape( function(){ GC.Node.load_parent();} );

    return utils;
  }())
};



