import leveldb;
import ConfigParser;
import json;
timeLine = {};
son = {};
parent = {}
def findAllNode(db, contentdb, now):
	key = "csxml_children_" + str(now);
	try:
		value = db.Get(key);
	except KeyError:
		value = "";
	data = json.loads(value);
	timeLine[now] = {};
	son[now] = []
	if (data["isleaf"] == 0):
		for subdata in data["children"]:
			x = subdata["node"];
			son[now].append(x);
			parent[x] = now;
			findAllNode(db, contentdb, x);
			for time in timeLine[x].keys():
				if (not time in timeLine[now]):
					timeLine[now][time] = 0;
				timeLine[now][time] += timeLine[x][time];
	else:
		for x in data["children"]:
			key = "csxml_content_" + str(x);
			try:
				value = contentdb.Get(key);
			except KeyError:
				value = "";
			data = json.loads(value);
			time = data["date"][0:4];
			if (not time in timeLine[now]):
				timeLine[now][time] = 0;
			timeLine[now][time] += 1;

cfg = ConfigParser.ConfigParser();
cfg.read('config.cfg');

META_LEVELDB = leveldb.LevelDB( cfg.get('main','meta_leveldb_loc') );
CONTENT_LEVELDB = leveldb.LevelDB( cfg.get('main','content_leveldb_loc') );
PUBMED_CONTENT_LEVELDB = leveldb.LevelDB( cfg.get('main','pubmed_content_leveldb_loc') );
query = "csxml_children"
root = 0;
findAllNode(META_LEVELDB, CONTENT_LEVELDB, root);
fout = open("timeLine-sum.dat", "w");
for node in timeLine.keys():
	fout.write(str(node));
	for year in range(1990,2005):
		if (str(year) in timeLine[node]):
			fout.write('\t' + str(timeLine[node][str(year)]));
		else:
			fout.write('\t0');
	fout.write('\n');
fout.flush();
fout = open("timeLine-rateto0.dat", "w")
for node in timeLine.keys():
	print(node);
	fout.write(str(node));
	for year in range(1990,2005):
		if (str(year) in timeLine[node]):
			fout.write('\t' + str(float(timeLine[node][str(year)])/float(timeLine[0][str(year)])));
		else:
			fout.write('\t0');
	fout.write('\n');
fout.flush();
fout = open("timeLine-ratetoparent.dat","w");
for node in timeLine.keys():
	fout.write(str(node));
	for year in range(1990,2005):
		if (node != 0 and str(year) in timeLine[node]):
			fout.write('\t' + str(float(timeLine[node][str(year)])/float(timeLine[parent[node]][str(year)])));
		else:
			fout.write('\t0');
	fout.write('\n');
fout.flush();
	
