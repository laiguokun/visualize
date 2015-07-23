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

  load : function( _dkey ) {
    GC.datakey = _dkey;
    GC.Hierarchy.load();
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
    else if ( value.type == 'TimeSeriesTree')
      req += "&GC_REQ=TimeSeriesTree&GC_NODE=" + value.node;
    else if ( value.type == 'TimeChange')
      req += "&GC_REQ=TimeChange&GC_NODE=" + value.node;
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
    var node = null;
    var year = 1994;
    var ws = null;
    var key = null;
    var relateSet = null;
    Node.showWord = function(s)
    {
      var data = JSON.parse(Node.ws[s]);
      Node.graphics.render_wordseries(data);
    }
    Node.load = function (n) {
      GC.GetValueFromServer({type:"timeLine",node:n} , Node.on_load_timeline)
    }
    Node.search = function(){
      var s = document.getElementById("search-word").value;
      Node.search_word(s);
    }
    Node.search_word = function(s){
      GC.GetValueFromServer({type:"searchNode", node:s}, Node.search_node);
    }   
    Node.search_node = function(s){
      var data = JSON.parse(s);
      var search_node = data.result;
      Node.key = search_node;
      Node.year = data.year;
      Node.load(search_node);
      Node.get_tree();
    }
    Node.on_load_timeline = function(s){
      var dataset = (JSON.parse(s));
      var data1 = JSON.parse(dataset[0]);
      var data2 = JSON.parse(dataset[1]);
      var data3 = JSON.parse(dataset[2]);
      var data4 = JSON.parse(dataset[3]);
      var data5 = JSON.parse(dataset[4]);
      Node.ws = data5;
      Node.graphics.render_timeLine(data1, data2, data3, data4, data5,Node.key);
    }
    Node.set_new_year = function()
    {
      Node.year = document.getElementById("search-year").value;
      Node.graphics.render_change_year();
      Node.get_tree();  
    }

    Node.get_tree = function()
    {
      GC.GetValueFromServer({type:"TimeSeriesTree",node:Node.key + "_" + Node.year} , Node.on_load_time_tree)
    }

    Node.on_load_time_tree = function(s)
    {
      var tmp = JSON.parse(s);
      Node.time_tree = JSON.parse(tmp.tree);
      var data6 = JSON.parse(tmp.relate);
      Node.relateSet = new Array();
      for (var i = 0; i < 4; i++)      
      {
        Node.relateSet[i] = data6[i];
        Node.relateSet[i].index = i;
      }
      Node.graphics.render_tree(Node.time_tree);
    }

    Node.updateAll = function(a, b)
    {
      Node.key = a;
      Node.year = b;
      Node.get_tree();
      Node.load(a);
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

      gx.timesvgr0 = null;
      gx.xScaler0 = null;
      gx.yScaler0 = null;
      gx.xAxisr0 = null;
      gx.xBarr0 = null;
      gx.yBarr0 = null;
      gx.liner0 = null;
      gx.pathr0 = null;

      gx.timesvgrp = null;
      gx.xScalerp = null;
      gx.yScalerp = null;
      gx.xAxisrp = null;
      gx.xBarrp = null;
      gx.yBarrp = null;
      gx.linerp = null;
      gx.pathrp = null;

      gx.timesvgws = null;
      gx.xScalews = null;
      gx.yScalews = null;
      gx.xAxisws = null;
      gx.xBarws = null;
      gx.yBarws = null;
      gx.linews = null;
      gx.pathws = null;

      gx.treesvg = null;
      gx.tree = null;
      gx.diagonal = null;
      gx.treeData = null;
      var wmargin = 70;
      var hmargin = 70;
      gx.root = null;
      gx.nodes = null;
      gx.node = null;
      gx.nodeEnter = null;
      gx.nodeUpdate = null;
      gx.link = null;
      gx.cnt = null;
      gx.root = null;
      gx.treetext = null;
      gx.relateNode = null;
      gx.relateNodeu = null;
      /* Add a svg element to the left-page. Well, you can put this in the html
       * as well. Add 'filters' to the svg object. Currently the only filter is
       * the 'shadow' filter which appears as a 'hover' on the circles.
       */

      (function setup_graphics(){
        //initialize the tree
        var w = document.documentElement.clientWidth*0.6;
        var h = document.documentElement.clientHeight*0.9;
        gx.tree = d3.layout.tree()
        .size([w-2*wmargin, h-2*hmargin]);

        gx.diagonal = d3.svg.diagonal()
          .projection(function(d) { return [d.x, d.y]; });

        gx.treetext = d3.select("#graph-part").append("svg")
        .attr("width", w)
        .attr("height", h);
        gx.treesvg = gx.treetext
        .append("g")
        .attr("transform", "translate(" + wmargin + "," + hmargin + ")");
        var hinter = (h - 2 * hmargin)/11;
        for (var year = 1994; year <= 2004; year ++)
        {
          gx.treetext.append("text")
          .attr("x", w - wmargin/2)
          .attr("y", hmargin + hinter * (year-1994) + hinter/2)
          .attr("text-anchor", "right")  
          .style("font-size", "12px") 
          .text(year.toString());
        }
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
        .text("the number of paper vs year");

        gx.xScale = d3.scale.linear()
          .domain([0,gx.xMarks.length-1])
          .range([padding,tw-padding]);
        gx.yScale = d3.scale.linear()
          .domain([0, d3.max(gx.timedata)])
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
        .text("the rate to dataset of paper number vs years");

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
        .text("the rate to parent of paper number vs years");
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


      gx.render_timeLine = function(data, datar0, datarp, datart, dataws, nodeid)
      {
//        var tw = document.documentElement.clientWidth*0.95*0.4;
 //       var th = document.documentElement.clientHeight*0.9; 
 //       var padding = 20;
        var oldData = gx.timedata;
        var oldDatar0 = gx.timedatar0;
        var oldDatarp = gx.timedatarp;
        gx.timedata = [];
        gx.timedatar0 = [];
        gx.timedatarp = [];
        gx.xMarks = [];
        var cnt = 0;
        for (var year = data.min; year <= data.max; year ++)
        {
          gx.timedata.push(parseInt(data[year]));
          gx.timedatar0.push(parseFloat(datar0[year]));
          gx.timedatarp.push(parseFloat(datarp[year]));
          if ((year-data.min) % 2 ==0)
          {
            gx.xMarks.push(year);
            cnt += 1;
          }
          else
            gx.xMarks.push(" ");
        }
        var newLength = gx.timedata.length;
        var _duration = 1000;
        //render sum box
        oldData = oldData.slice(0,gx.timedata.length);
        var circle = gx.timesvg.selectAll("circle").data(oldData);
        circle.exit().remove();
        gx.timesvg.selectAll("circle")
        .data(gx.timedata)
        .enter()
        .append("a")
        .attr("xlink:href", "http://www.google.com")
        .append("circle")
        .attr("cx", function(d,i){
          if(i>=oldData.length) return tw-padding; else return gx.xScale(i);
        })  
        .attr("cy",function(d,i){
          if(i>=oldData.length) return th-padding; else return gx.yScale(d);
        })  
        gx.timesvg.selectAll("circle")
        .attr("r",5)
        .style("fill",function(d,i){
          if ((i+1994).toString() == Node.year)
            return '#09F';
          else return 'grey';
        });
        gx.xScale.domain([0,newLength - 1]);   
        gx.xAxis.scale(gx.xScale).ticks(cnt);
        gx.xBar.transition().duration(_duration).call(gx.xAxis);
        gx.xBar.selectAll("text").text(function(d){return gx.xMarks[d];});
        gx.yScale.domain([0,d3.max(gx.timedata)]);       
        gx.yBar.transition().duration(_duration).call(gx.yAxis);
        gx.path.transition().duration(_duration).attr("d",gx.line(gx.timedata));
        //重绘4圆点 
        var urltmp = "http://bonda.lti.cs.cmu.edu/mfhdt/html/all/"
        urltmp += "node=" + Node.key.toString() + ".flat=0.time=" ;
        gx.timesvg.selectAll("a")
        .attr("xlink:href", function(d,i) {return urltmp + (1995+i).toString() + '.html';});
        gx.timesvg.selectAll("circle")   
        .transition()
        .duration(_duration)
        .attr("cx", function(d,i) {       
            return gx.xScale(i);
        })  
        .attr("cy", function(d) {
            return gx.yScale(d);  
        }); 
        //render r0 box
        oldDatar0 = oldDatar0.slice(0,gx.timedata.length);
        var circler0 = gx.timesvgr0.selectAll("circle").data(oldDatar0);
        circler0.exit().remove();
        gx.timesvgr0.selectAll("circle")
        .data(gx.timedatar0)
        .enter()
        .append("a")
        .attr("xlink:href", "http://www.google.com")
        .append("circle")
        .attr("cx", function(d,i){
          if(i>=oldData.length) return tw-padding; else return gx.xScale(i);
        })  
        .attr("cy",function(d,i){
          if(i>=oldData.length) return th-padding; else return gx.yScale(d);
        })  
        gx.timesvgr0.selectAll("circle")
        .attr("r",5)
        .style("fill",function(d,i){
          if ((i+1994).toString() == Node.year)
            return '#09F';
          else return 'grey';
        });
        gx.xScaler0.domain([0,newLength - 1]);   
        gx.xAxisr0.scale(gx.xScaler0).ticks(cnt);
        gx.xBarr0.transition().duration(_duration).call(gx.xAxisr0);
        gx.xBarr0.selectAll("text").text(function(d){return gx.xMarks[d];});
        gx.yScaler0.domain([0,d3.max(gx.timedatar0)]);       
        gx.yBarr0.transition().duration(_duration).call(gx.yAxisr0);
        gx.pathr0.transition().duration(_duration).attr("d",gx.liner0(gx.timedatar0));
        //重绘4圆点 
        var urltmp = "http://bonda.lti.cs.cmu.edu/mfhdt/html/all/"
        urltmp += "node=" + Node.key.toString() + ".flat=0.time=" ;
        gx.timesvgr0.selectAll("a")
        .attr("xlink:href", function(d,i) {return urltmp + (1995+i).toString() + '.html';});
        gx.timesvgr0.selectAll("circle")   
        .transition()
        .duration(_duration)
        .attr("cx", function(d,i) {       
            return gx.xScaler0(i);
        })  
        .attr("cy", function(d) {
            return gx.yScaler0(d);  
        });
        //rate to parent
        oldDatarp = oldDatarp.slice(0,gx.timedata.length);
        var circlerp = gx.timesvgrp.selectAll("circle").data(oldDatarp);
        circlerp.exit().remove();
        gx.timesvgrp.selectAll("circle")
        .data(gx.timedatarp)
        .enter()
        .append("a")
        .attr("xlink:href", "http://www.google.com")
        .append("circle")
        .attr("cx", function(d,i){
          if(i>=oldData.length) return tw-padding; else return gx.xScalerp(i);
        })  
        .attr("cy",function(d,i){
          if(i>=oldData.length) return th-padding; else return gx.yScalerp(d);
        })  
        gx.timesvgrp.selectAll("circle")
        .attr("r",5)
        .style("fill",function(d,i){
          if ((i+1994).toString() == Node.year)
            return '#09F';
          else return 'grey';
        });
        gx.xScalerp.domain([0,newLength - 1]);   
        gx.xAxisrp.scale(gx.xScalerp).ticks(cnt);
        gx.xBarrp.transition().duration(_duration).call(gx.xAxisrp);
        gx.xBarrp.selectAll("text").text(function(d){return gx.xMarks[d];});
        gx.yScalerp.domain([0,d3.max(gx.timedatarp)]);       
        gx.yBarrp.transition().duration(_duration).call(gx.yAxisrp);
        gx.pathrp.transition().duration(_duration).attr("d",gx.linerp(gx.timedatarp));
        //重绘4圆点 
        var urltmp = "http://bonda.lti.cs.cmu.edu/mfhdt/html/all/"
        urltmp += "node=" + Node.key.toString() + ".flat=0.time=" ;
        gx.timesvgrp.selectAll("a")
        .attr("xlink:href", function(d,i) {return urltmp + (1995+i).toString() + '.html';});
        gx.timesvgrp.selectAll("circle")   
        .transition()
        .duration(_duration)
        .attr("cx", function(d,i) {       
            return gx.xScalerp(i);
        })  
        .attr("cy", function(d) {
            return gx.yScalerp(d);  
        });

        var wordset = Object.keys(dataws);
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

      gx.render_wordseries = function (data)
      {
//        var padding = 20;
 //       var th = 200;
//        var tw = 400;
        var oldData = gx.timedataws;
        gx.timedataws = [];
        gx.xMarksws = []
        var cnt = 0;
        for (var year = 1994; year <= 2004; year ++)
        {
          var tmp = parseInt(data[year]);
          if (tmp == 0)
            gx.timedataws.push(0);
          else
            gx.timedataws.push(1.0/tmp);
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
        oldData = oldData.slice(0,gx.timedataws.length);
        var circle = gx.timesvgws.selectAll("circle").data(oldData);
        circle.exit().remove();
        gx.timesvgws.selectAll("circle")
        .data(gx.timedataws)
        .enter()
        .append("a")
        .attr("xlink:href", "http://www.google.com")
        .append("circle")
        .attr("cx", function(d,i){
          if(i>=oldData.length) return tw-padding; else return gx.xScale(i);
        })  
        .attr("cy",function(d,i){
          if(i>=oldData.length) return th-padding; else return gx.yScale(d);
        })  
        gx.timesvgws.selectAll("circle")
        .attr("r",5)
        .style("fill",function(d,i){
          if ((i+1994).toString() == Node.year)
            return '#09F';
          else return 'grey';
        });
        gx.xScalews.domain([0,newLength - 1]);   
        gx.xAxisws.scale(gx.xScalews).ticks(cnt);
        gx.xBarws.transition().duration(_duration).call(gx.xAxisws);
        gx.xBarws.selectAll("text").text(function(d){return gx.xMarksws[d];});
        gx.yScalews.domain([0,d3.max(gx.timedataws)]);       
        gx.yBarws.transition().duration(_duration).call(gx.yAxisws);
        gx.pathws.transition().duration(_duration).attr("d",gx.linews(gx.timedataws));
        //重绘4圆点 
        var urltmp = "http://bonda.lti.cs.cmu.edu/mfhdt/html/all/"
        urltmp += "node=" + Node.key.toString() + ".flat=0.time=" ;
        gx.timesvgws.selectAll("a")
        .attr("xlink:href", function(d,i) {return urltmp + (1995+i).toString() + '.html';});
        gx.timesvgws.selectAll("circle")   
        .transition()
        .duration(_duration)
        .attr("cx", function(d,i) {       
            return gx.xScalews(i);
        })  
        .attr("cy", function(d) {
            return gx.yScalews(d);  
        }); 
      }   
      gx.render_change_year = function()
      {
        gx.timesvg.selectAll("circle")
        .attr("r", 5)
        .style("fill",function(d,i){
          if ((i+1994).toString() == Node.year)
            return '#09F';
          else return 'grey';
        });
        gx.timesvgr0.selectAll("circle")
        .attr("r", 5)
        .style("fill",function(d,i){
          if ((i+1994).toString() == Node.year)
            return '#09F';
          else return 'grey';
        });
        gx.timesvgrp.selectAll("circle")
        .attr("r", 5)
        .style("fill",function(d,i){
          if ((i+1994).toString() == Node.year)
            return '#09F';
          else return 'grey';
        });
        gx.timesvgws.selectAll("circle")
        .attr("r", 5)
        .style("fill",function(d,i){
          if ((i+1994).toString() == Node.year)
            return '#09F';
          else return 'grey';
        });
      }

      gx.calc_new_coord = function(node, width, hinter, year_cnt)
      {
        var winter = width / 12;
        if (Node.year == node.year)
          winter = width/5;
        if (node.children == undefined)
          return;
        var cnt1 = 0;
        var cnt2 = 0;
        for (var i = 0; i < node.children.length; i++)
        {
          if (node.children[i].mark == 1)
            cnt1 +=1;
          else
            cnt2 +=1;
        }
        if (cnt1 != 0)
        {
          for (var i = 0; i < node.children.length; i++)
            if (node.children[i].mark == 1)
            {
              node.children[i].y = node.y + hinter;
              node.children[i].x = year_cnt[1][node.year] * winter + winter/2;
              gx.calc_new_coord(node.children[i], width, hinter, year_cnt);
              year_cnt[1][node.year] += 1;
            }
        }
        if (cnt2 != 0)
        {
          for (var i = 0; i < node.children.length; i++)
            if (node.children[i].mark == 2)
            {
              node.children[i].y = node.y - hinter;
              node.children[i].x = year_cnt[2][node.year] * winter + winter/2;
              gx.calc_new_coord(node.children[i], width, hinter, year_cnt);
              year_cnt[2][node.year] += 1;
            }
        }
      }
      gx.convert = function(nodes)
      {
        var w = document.documentElement.clientWidth*0.95*0.6 - 2 * wmargin;
        var h = document.documentElement.clientHeight*0.9 - 2 * hmargin;
        var index = parseInt(Node.year) - 1994;
        var rootnode = null;
        for (var i = 0; i < nodes.length; i++)
          if (nodes[i].depth == 0)
            rootnode = nodes[i];
        var hinter = h/11;
        rootnode.x = w/2;
        rootnode.y = hinter * index + hinter/2;
        rootnode.x0 = rootnode.x;
        rootnode.y0 = rootnode.y;
        var year_cnt = new Array();
        year_cnt[1] = new Array();
        year_cnt[2] = new Array();
        for (var i = 1994; i <= 2004; i++)
        {
          year_cnt[1][i.toString()] = 0;
          year_cnt[2][i.toString()] = 0;
        }
        gx.calc_new_coord(rootnode, w, hinter, year_cnt);
      }

      gx.render_tree = function(root)
      {
        gx.root = root;
        var w = document.documentElement.clientWidth*0.95*0.6 - 2 *wmargin;
        var h = document.documentElement.clientHeight*0.9 - 2 * hmargin;
        var duration = 750;
        gx.cnt = 0;
        gx.treesvg.selectAll("*").remove();
        gx.nodes = gx.tree.nodes(gx.root).reverse();
        gx.convert(gx.nodes);
        //insert relate topic
        var winter = w / 5;
        for (var i = 0; i < Node.relateSet.length; i++)
        {
          if (i < 2) Node.relateSet[i].x = root.x0 - (2-i) * winter;
          else Node.relateSet[i].x = root.x0 + (4-i) * winter;
          Node.relateSet[i].y = root.y0;
          gx.nodes.push(Node.relateSet[i]);
        }
        gx.links = gx.tree.links(gx.nodes);
        gx.node = gx.treesvg.selectAll("g.node")
                  .data(gx.nodes, function(d){return d.id || (d.id = ++gx.cnt);});
        gx.nodeEnter = gx.node.enter().append("g")
                      .attr("class","node")
                      .attr("transform", function(d) {return "translate(" + root.x0 + "," + root.y0 + ")";})
                      .on("click", function(d){
                        GC.Node.updateAll(d.topic, d.year)
                      });
        gx.nodeEnter.append("circle")
        .attr("r", function(d){
          if (d.mark == 0)
            return 15;
          return 10;
        })
        .style("fill", function(d){
          return "rgb( " + Math.round(255.0 * d.diff) 
          + "," + Math.round(255.0 * (1.0-d.diff)) +  ", 0)";

        })
        gx.nodeEnter
        .append("title").text(function(d){ return d.desc.join(", ")});
        gx.nodeEnter.append("text")
        .attr("y", function(d){ 
          if (d.mark == 0)
            return 0;
          if (d.mark == 1) 
          {
            return d.children ? -20:20;
          }
          else
          {
            return d.children ? 20:-20;
          }
        }
        )
        .attr("dy",".35em")
        .attr("text-anchor", function(d){return "middle"})
        .text(function(d){return d.desc[0]})
        .style("fill-opacity",1e-6);              
        gx.nodeEnter
        .append("title").text(function(d){ return d.desc.join(", ")});    
        gx.nodeEnter.append("text")
        .attr("y", -20)
        .attr("dy",".35em")
        .attr("text-anchor", function(d){return "middle"})
        .text(function(d){return d.desc[0]})
        .style("fill-opacity",1e-6);

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
        })
        .attr("stroke-width", function(d){
          return 10 * d.target.rank;
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


