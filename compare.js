/*
 * The JS is not "robust" and non-obfuscated :-)
 */

var start = 0;



var GC = {

  /* default message */

  /* Stores the name of the dataset */
  datakey : "" , 

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

  NodeA : (function(){
    var NodeA = new Object();
    var NodeB = new Object();

    Node.graphics = (function(){

      var gx = new Object();

      /* Setup the d3.js parameters and data */

      gx.d3data = null;

      var w = document.documentElement.clientWidth*90/100;
      var h = document.documentElement.clientHeight;
      var x = Math.min ( w*60.0/100 , 95.0/100*h );
      var tw = 400;
      var th = 200;
      var padding = 50;

      gx.timedata = [];
      gx.timedatar0 = [];
      gx.timedatarp = [];
      gx.timedataws = []
      gx.xMarks = [];
      gx.xMarksws = []
      gx.diameter = Math.max( x , 500 );
      gx.grow_rate = null;
      gx.format = d3.format(",d");

      /* Define the circle-circle pack layout */

      gx.pack = d3.layout.pack()
	       .size([ gx.diameter-4 , gx.diameter-4 ])
	       .padding(5)
	       .value(function(d) { return d.size; });

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

      /* Add a svg element to the left-page. Well, you can put this in the html
       * as well. Add 'filters' to the svg object. Currently the only filter is
       * the 'shadow' filter which appears as a 'hover' on the circles.
       */

      (function setup_graphics(){
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
          .domain([0,gx.timedata.length-1])
          .range([padding,tw-padding]);
        gx.yScale = d3.scale.linear()
          .domain([0,d3.max(gx.timedata)])
          .range([th-padding,padding]);
        gx.xAxis = d3.svg.axis()
          .scale(gx.xScale)  
          .orient("bottom").ticks(gx.timedata.length);
        
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
          .style("stroke","#F00")
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
          .domain([0,gx.timedatar0.length-1])
          .range([padding,tw-padding]);
        gx.yScaler0 = d3.scale.linear()
          .domain([0,d3.max(gx.timedatar0)])
          .range([th-padding,padding]);
        gx.xAxisr0 = d3.svg.axis()
          .scale(gx.xScaler0)  
          .orient("bottom").ticks(gx.timedatar0.length); 
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
          .domain([0,gx.timedatarp.length-1])
          .range([padding,tw-padding]);
        gx.yScalerp = d3.scale.linear()
          .domain([0,d3.max(gx.timedatarp)])
          .range([th-padding,padding]);
        gx.xAxisrp = d3.svg.axis()
          .scale(gx.xScalerp)  
          .orient("bottom").ticks(gx.timedatarp.length); 
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
          .domain([0,gx.timedataws.length-1])
          .range([padding,tw-padding]);
        gx.yScalews = d3.scale.linear()
          .domain([0,d3.max(gx.timedataws)])
          .range([th-padding,padding]);
        gx.xAxisws = d3.svg.axis()
          .scale(gx.xScalews)  
          .orient("bottom").ticks(gx.timedataws.length); 
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
        var padding = 20;
        var th = 200;
        var tw = 400;
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
        .attr("fill","#09F");
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
        .attr("fill","#09F");
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
        .attr("fill","#09F");
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



        //relate topic
        var rtopic = document.getElementById("relate-topic-content");
        while (rtopic.hasChildNodes()) {   
          rtopic.removeChild(rtopic.firstChild);
        }
        if (datart.length != 0 && datart.length != undefined)
        {
          var textnode = document.createTextNode("relate topic: ")
          rtopic.appendChild(textnode);
        }
        for (var i = 0; i < datart.length; i++)
        {
          var node = document.createElement("a");
          var textnode = document.createTextNode("Topic" + datart[i].toString()+ " ");
          node.appendChild(textnode);
          node.href = "javascript:void(0)";
          node.index = datart[i].toString();
          node.onclick = function(){Node.load(this.index)};
          rtopic.appendChild(node);
        }

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
        var padding = 20;
        var th = 200;
        var tw = 400;
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
        .attr("fill","#09F");
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



