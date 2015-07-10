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
      GC.Node.load(start);
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

  Node : (function(){
    var Node = new Object();

    /* Node.key: is the nodeid of the current node , 
     * Node.display_state: is valid only for leaf nodes. Denotes which 
     *                     instance-id is currently being displayed
     * Node.data: contains the data for the node.
     *            Note that scores for the words are not used 
     *            [may be you can scale word size by the score ]
     */
    Node.key = -1;
    Node.display_state = -1;
    Node.data = null;
    Node.dataset = new Array();
    /* Sets the Node information to match the input data */    

    Node.set_data = function (_data) {
      Node.data = _data;
      Node.key = _data.node;
      if ( _data.isleaf ) Node.display_state = 0;
      else Node.display_state = -1;
    }

    /* Associated helper functions */

    Node.get_node = function () {
      return Node.key;
    }

    Node.is_leaf = function () {
      if ( Node.key == -1 ) return false;
      return Node.data.isleaf;
    } 

    Node.get_nchildren = function () {
      return Node.data.children.length;
    }

    Node.get_child_size = function (n) {
      return Node.data.children[n].size;
    }

    Node.get_child_id = function (n) {
      if ( Node.is_leaf() ) return Node.data.children[n];
      return Node.data.children[n].node;
    }

    /* Returns the top 'limit' descriptions for the 'n'th childnode in 
     * the children array.
     */

    Node.get_child_desc = function (n , limit) {
      if ( limit == undefined )
	limit = Node.data.children[n].desc.length;
      limit = Math.min ( limit , Node.data.children[n].desc.length );

      var ret = new Array(limit);

      for ( var i = 0; i < limit; ++i ) 
	ret[i] = Node.data.children[n].desc[i];
      return ret;
    }

    /* On receiving Node data from server , 
       (a) Ensure correct state of load data 
       (b) Render the Node appropriately
    */
    Node.on_load = function (s) {
      var prev_isleaf = Node.is_leaf();
      Node.set_data( JSON.parse(s) );

      if ( Node.is_leaf() ) 
	Node.render_leaf();
      else {
	// Dont redraw if returning back from leaf-node
	//if ( prev_isleaf == false ) 
	  Node.render_nonleaf();
      }
    }

    Node.on_load_timeline = function(s){
      var dataset = (JSON.parse(s));
      var data1 = JSON.parse(dataset[0]);
      var data2 = JSON.parse(dataset[1]);
      var data3 = JSON.parse(dataset[2]);
      var data4 = JSON.parse(dataset[3]);
      Node.graphics.render_timeLine(data1, data2, data3, data4, Node.key);
    }
    /* Loads the node - calls the 'on_load' on data receive */

    Node.load = function (n) {
      GC.GetValueFromServer({type:"children",node:n} , Node.on_load );
      GC.GetValueFromServer({type:"timeLine",node:n} , Node.on_load_timeline)
    }
    /* From the current-node (non-root), calls loads the parent node */

    Node.load_parent = function () {
      if ( Node.key != 0 ) {
	n = GC.Hierarchy.get_parent( Node.key );
	Node.load(n);
      }
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
      var relate_word = data.relate;
      var rtopic = document.getElementById("relate-word-content");
      while (rtopic.hasChildNodes()) {   
        rtopic.removeChild(rtopic.firstChild);
      }
      var textnode = document.createTextNode("relate word: ")
      rtopic.appendChild(textnode);
      for (var i = 0; i < relate_word.length; i++)
      {
        var node = document.createElement("a");
        var textnode = document.createTextNode(relate_word[i].toString()+ " ");
        node.appendChild(textnode);
        node.href = "javascript:void(0)";
        node.index = relate_word[i].toString();
        node.onclick = function(){Node.search_word(this.index)};
        rtopic.appendChild(node);
      }
      Node.load(search_node);
    }
    /* For leaf-nodes, this renders the 'next' instance (if any).
     * No effect on non-leaf nodes.
     */

    Node.load_next = function () {
      if ( Node.is_leaf() && Node.display_state+1 < Node.get_nchildren() ) {
	Node.display_state++;
	Node.render_leaf();
      }
    }

    /* For leaf-nodes, this renders the 'previous' instance (if any).
     * No effect on non-leaf nodes.
     */

    Node.load_prev = function () {
      if ( Node.is_leaf() && Node.display_state > 0 ) {
	Node.display_state--;
	Node.render_leaf();
      }
    }

    /* The non-leaf Node rendering function. It sets up the d3data from the
     * current Node data and uses the graphics object to render it 
     */

    Node.render_nonleaf = function () {
      var d3data = new Object();
      var nc = Node.get_nchildren();

      /* d3data contains
       * names: the description of the node on the side-bar (filled later)
       * nodeid: the current nodeid
       * children: {size:<size> , nodeid:<nodeid>}
       * desc: An array of [word array] describing each child 
       */

      d3data.name = "";
      d3data.nodeid = Node.get_node();
      d3data.children = new Array(nc);
      d3data.desc = {};

      for ( var i = 0; i < nc; ++i ) {
	d3data.children[i] = new Object();
	d3data.children[i].size = Node.get_child_size(i);
	var n = Node.get_child_id(i);
	d3data.children[i].nodeid = n;
	d3data.desc[n] = Node.get_child_desc(i);
      }
      
      Node.graphics.render_nonleaf( d3data );
    }

    /* For a leaf-node , display the content associated 
     * with display_state variable. The display_state should be
     * non-zero if the node is a leaf-node.
     * [Calls the on_leaf_load function once data is retrieved]
     */

    Node.render_leaf = function () {
//      if ( Node.display_state > -1 )
      if (Node.display_state > -1 )
	GC.GetValueFromServer({
	  type:"content",
	  node:Node.get_child_id(Node.display_state)} 
			      , Node.on_leaf_load );
    }

    /* Use the graphics object to display recieved 'leaf' content */

    Node.on_leaf_load = function (s) {
        Node.graphics.render_leaf(JSON.parse(s));
    }

    /* This is the main 'graphics' object for a node. There are only 2 main
     * function that should be visible.
     *    1. gx.render_leaf_node ( content data )
     *    2. gx.render_nonleaf ( d3data )
     *
     * It is responsible for displaying non-leaf nodes as well as content
     * from any leaf-node.
     * If you want to change how things are displayed - this is the place
     * to change (and obviously the associated css file)
     */

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
      gx.xMarks = [];
      gx.diameter = Math.max( x , 500 );

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

      /* Add a svg element to the left-page. Well, you can put this in the html
       * as well. Add 'filters' to the svg object. Currently the only filter is
       * the 'shadow' filter which appears as a 'hover' on the circles.
       */

      (function setup_graphics(){

	/* Add <svg> tag */
	var svg = d3.select("#graph-part").append("svg")
	      .attr("width" , gx.diameter )
	      .attr("height" , gx.diameter );

	/* Add the filter definitions */
	var defs = svg.append("defs");

	var filter = defs.append("filter")
	  .attr("id", "drop-shadow")
	  .attr("height", "150%");
	filter.append("feGaussianBlur")
	  .attr("in", "SourceAlpha")
	  .attr("stdDeviation", 5)
	  .attr("result", "blur");
	filter.append("feOffset")
	  .attr("in", "blur")
	  .attr("dx", 5)
	  .attr("dy", 5)
	  .attr("result", "offsetBlur");

	var feMerge = filter.append("feMerge"); 

	feMerge.append("feMergeNode")
	  .attr("in", "offsetBlur")
	feMerge.append("feMergeNode")
	  .attr("in", "SourceGraphic");



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
      }());

      /* One private function */

      gx.get_class = function( nodeid ) {
	if ( GC.Hierarchy.is_leaf(nodeid) ) 
	  return "leaf";
	return "child";
      }

      /* The 'core' non-leaf node rendering function using d3js */

      gx.d3nonleaf = function (root) {

	/* Send data to 'pack layout', add <g> tags to the svg */
	
	var node = gx.container.datum(root).selectAll(".node")
	  .data(gx.pack.nodes)
	  .enter().append("g")
	  .attr("class", 
		function (d) { 
		  return d.children ? "root" : gx.get_class(d.nodeid);
		})
	  .attr("transform", 
		function (d) { return "translate(" + d.x + "," + d.y + ")"; });

	/* Add <title> tag to the svg for all children */
  node.append("title")
    .text(function (d) { 
      if (gx.d3data.desc[d.nodeid]!=null)
          return gx.d3data.desc[d.nodeid].join(", ");
        else return "";
          }
         );
	/* add circles for each data i.e. 1 (root) + children.length */

	node.append("circle");

	/* For all the child-nodes add the 'shadow filter' and 
	 * a 'transition in' effect 
	 */

	node.select("circle")
	  .filter(function (d) { return !d.children; })
	  .transition().duration(1000)
	  .style("fill-opacity",1)
	  .style("stroke-opacity",1)

	/* Update radius for each circle, 'the radius' is already calculated
	 * by the 'pack layout' function.
	 */

	node.select("circle")
	  .attr("r", function (d) { return d.r; })
	  .attr("id" , function (d) { return "node" + d.nodeid; } )

	/* Setup the onclick function to load the corresponding child-node */

	node.select("circle")
	  .filter(function (d) { return !d.children; })
	  .on("click" , function(d){ return GC.Node.load(d.nodeid);} );

	/* Setup the 'hover' function to update the side-bar appropriately.
	 * The 'hover' actually called render_nonleaf_mouse_action 
	 * with true/false depening on moving in/moving out.
	 */

	node.select("circle")
	  .filter(function (d) { return !d.children; })
	  .on("mouseover", function(d){ 
	    d3.select(this).style("filter","url(#drop-shadow)");
	    gx.render_nonleaf_mouse_action(d.nodeid,false);
	  })
	  .on("mouseout", function(d){ 
	    d3.select(this).style("filter","");
	    gx.render_nonleaf_mouse_action(d.nodeid,true);
	  })

	/* For all the children nodes, add the <text> tag */

	node.filter(function (d) { return !d.children; }).append("text");	

	/* Add the 'transition in' effect for the <text> tag as well 
	 * Note that <text> tag does not capture mouse-event (see css file)
	 */

	node.select("text")
	  .filter(function (d) { return !d.children; })
	  .transition().delay(300)
	  .attr("dy", ".3em")
	  .style("text-anchor", "middle")
	  .text(function (d) { return d.name.substring(0, d.r / 3); });
      }

      /* Reformart the top 'limit' words of each child using camel-case 
       * Update this data into 'names'
       */

      gx.generate_names = function (d3data) {
	for ( var i = 0; i < d3data.children.length; ++i ) {
	  var lim = 2 , s = "";
	  var n = d3data.children[i].nodeid;
	  for ( var j = 0; j < lim; ++j ) 
	    s += (j > 0 ? ", " : "" ) + 
	    GC.utils.camel_case(d3data.desc[n][j]);
	  d3data.children[i].name = s;
	}
      }

      /* Defines the mouse-behaviour for 'hover' action on the circles.
       * This is the place to change 'side-bar' behaviour
       * If 'clear' is 'true', 
       *      1. Then mouse moved out
       *      2. Reset it to the default message
       * If 'clear' is false,
       *      1. Mouse moved in 
       *      2. Display the side-bar
       */
       
      gx.render_nonleaf_mouse_action = function(nodeid,clear) {
      }

      gx.render_timeLine_mouse_action = function(nodeid,clear) {
      }

      gx.render_timeLine = function(data, datar0, datarp, datart, nodeid)
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
          if ((year-data.min) % 5 ==0)
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
        .attr("xlink:href", function(d,i) {return urltmp + (1990+i).toString() + '.html';});
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
        .attr("xlink:href", function(d,i) {return urltmp + (1990+i).toString() + '.html';});
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
        .attr("xlink:href", function(d,i) {return urltmp + (1990+i).toString() + '.html';});
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
        var textnode = document.createTextNode("relate topic: ")
        rtopic.appendChild(textnode);
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
      }   

      /* The wrapper around the 'core' nonleaf-rendering function.
       * This functions setsup the preliminaries and calls the core function.
       */

      gx.render_nonleaf = function (d3data) {

	/* Remove any previous data i.e. 'transition out' the container */

	if ( gx.d3data ) {
	  gx.container.data([]).exit().transition().duration(500)
	    .style("opacity",0)
	    .remove();
	}

	/* Sets the d3data to the input d3data */

	gx.d3data = d3data;

	/* Adds the <g> tag (container) to left-page and draw inside it.
	 * This is because you 'transition out' this container instead of 
	 * deleting the <svg>
	 */

	gx.container = d3.select("#left-page").select("svg").append("g")
	  .attr("transform", "translate(2,2)");

	/* Generate 'pretty' names for all the child nodes. These 'names' are 
	 * displayed inside the circle. There is no text-wrapping :-/
	 */
	gx.generate_names(d3data);

	/* Call the core non-leaf rendering function */

	gx.d3nonleaf(d3data);

	/* Not sure what this is, but it was given in d3js examples :-) */

	d3.select(self.frameElement).style("height", gx.diameter + "px");
      }


      /* Renders the content given the 'data' for the content.
       * This is the place to change to display different kinds of data 
       */

      gx.render_leaf = function (data) {
	
	/* Create the 'text' to be displayed for the leaf-node */
	var text = "";
	text = gx.gen_text(data);

	/* Dim the surrounding, light up the overlay and put content */
	gx.dim();
	document.getElementById('overlay-text').innerHTML = text;
      }

      /* The text for different data kinds of data */

      gx.gen_text = function (data) {

	var text = "";
	if ( data.headline ) 
	  text += "<h2 class='headline'>" + data.headline + "</h2>";
	else if ( data.title ) 
	  text += "<h2 class='headline'>" + data.title + "</h2>";
	if ( data.byline ) 
	  text += "<h4 class='bydateline'>" + data.byline + "</h4>";
	if ( data.dateline ) 
	  text += "<h4 class='bydateline'>" + data.dateline + "</h4>";
	else if ( data.date ) {
	  if ( GC.datakey == 'ipc' ) 
	    text += "<big>Filed on</big> : <span class='bydateline'>" + data.date + "</span>";
	  else
	    text += "<h4 class='bydateline'>" + data.date + "</h4>";
	}

	if ( GC.datakey == 'ipc' ) {
	  data.text = "Patent number &nbsp; <b>" + data.id + "</b> cannot be displayed ";
	  data.text += "due to licensing restrictions.";
	}

	if ( !(typeof(data.text) === 'string') ) {
	  for ( var i = 0; i < data.text.length; ++i ) 
	    text += "<p>" + data.text[i] + "</p>";
	}
	else if ( data.text ) {
	  text += "<p>" + data.text + "</p>";
	}
	return text;
      }

      /* The function is used for rendering the leaf. It dims the container
       * and sidebar, and brings the 'overlay' to the front. The content can 
       * then be displayed on the 'overlay'.
       * The udimming can be be done by 
       *       1. pressing the 'exit' button.
       *       2. pressing the 'escape key'
       *       3. clicking outside the overlay.
       *
       * NOTE: This function can be safely called multiple times but undimmed
       *       only once.
       */

      gx.dim = function() {

	var f = function(){ gx.undim();};
	var fn = function(){ Node.load_next();}
	var fp = function(){ Node.load_prev();}

	/* Dim the background */
//	document.getElementById('dim').style.display='block';
	document.getElementById('dim').onclick = f;

	/* Hook the keys */
	document.getElementById('overlay-top-left').onclick = f;
	document.getElementById('overlay-top-pright').onclick = fp;
	document.getElementById('overlay-top-nright').onclick = fn;

	GC.utils.hookescape(f);
	GC.utils.hooknext(fn);
	GC.utils.hookprev(fp);

	/* Bring the overlay to the front */
	document.getElementById('overlay').style.display='block';
//	document.body.style.overflow='hidden';
      };


      /* This undims i.e the overlay is removed and background is displayed
       * again. This functio is automatically set to be called by 'dim'.
       * Do not use it (unless you're awesome)
       *
       * NOTE: Unlike dim, this should be called exactly once as it reloads 
       *       parent of the current leaf-node.
       */

      gx.undim = function () {
	/* Unhook the keys */
	GC.utils.unhookall();
	GC.utils.hookescape( function(){ Node.load_parent();} );

	/* Moves the overlay to the back */
	document.getElementById('dim').style.display='none';
	document.getElementById('overlay').style.display='none';
	document.body.style.overflow = "scroll";

	/* Reload the parent */
	Node.load_parent();
      };

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




/* This function draw a next/prev button on canvas id 'id' 
 * inside a box of length 'L' and fill-color 'fill'
 */

GC.draw_center_button = function( L , forward , fill , id ) {
  var canvas = document.getElementById(id);
  var ctx = canvas.getContext('2d');

  var H = L/5;
  var TH = L/2;
  var W = L/7;
  var U = L/8;
  var mult = forward;

  var cx = canvas.width / 2;
  var cy = canvas.height / 2;
  var radius = L/2;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, 2 * Math.PI, false);
  ctx.lineWidth = L/10;
  ctx.strokeStyle = fill;
  ctx.stroke();

  var sx = cx , sy = cy;
  ctx.beginPath();
  sx = cx;

  sx += mult*(- TH/2 + W/2 );
  sy = cy - W/2;
  
  ctx.moveTo(sx,sy);
  sx += mult*(TH-H-W/2);
  ctx.lineTo(sx, sy);

  sy -= U;
  ctx.lineTo(sx, sy);

  sx += mult*H;
  sy += (U+W/2);
  ctx.lineTo(sx, sy);

  sx -= mult*H;
  sy += (U+W/2);
  ctx.lineTo(sx, sy);

  sy -= U;
  ctx.lineTo(sx, sy);

  sx -= mult*(TH-H-W/2);
  ctx.lineTo(sx, sy);

  sy -= W/2;
  ctx.arc(sx, sy, W/2, (1-mult/2)*Math.PI,  (1+mult/2)*Math.PI, false);    


  ctx.closePath();
  ctx.lineWidth = 0;
  ctx.fillStyle = fill;
  ctx.fill();
}


GC.draw_exit_button  = function( L , fill , id ) {
  var canvas = document.getElementById(id);
  var ctx = canvas.getContext('2d');

  var H = L/2.5;
  var B = L/10;

  var cx = canvas.width / 2;
  var cy = canvas.height / 2;
  var radius = L/2;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, 2 * Math.PI, false);
  ctx.lineWidth = L/10;
  ctx.strokeStyle = fill;
  ctx.stroke();

  
  ctx.lineWidth = B;
  ctx.strokeStyle = fill;

  ctx.beginPath();
  ctx.moveTo( cx-H/2,cy+H/2 );
  ctx.lineTo( cx+H/2,cy-H/2 );
  ctx.lineCap = 'round';
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo( cx-H/2,cy-H/2 );
  ctx.lineTo( cx+H/2,cy+H/2 );
  ctx.lineCap = 'round';
  ctx.stroke();

}
