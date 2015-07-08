import leveldb;
import ConfigParser;
import json;
timeLine = {};
son = {};
parent = {}
lexicon = {}
min_rank_word = {}
deep = {}
size = {}
isLeaf = {}
def findAllNode(db, depth, now):
	key = "csxml_children_" + str(now);
	try:
		value = db.Get(key);
	except KeyError:
		value = "";
	data = json.loads(value);
	deep[now] = depth;
	size[now] = int(data["size"]);
	if (data["isleaf"] == 0):
		for subdata in data["children"]:
			x = subdata["node"];
			desc = subdata["desc"];
			for i in range(len(desc)):
				word = desc[i];
				if (not word in lexicon):
					lexicon[word] = [];
					min_rank_word[word] = 100;
				if (i == min_rank_word[word]):
					lexicon[word].append(x);
				if (i < min_rank_word[word]):
					min_rank_word[word] = i;
					lexicon[word] = [];
					lexicon[word].append(x);
			findAllNode(db, depth + 1, x);
	else:
		deep[now] = depth + 3;



cfg = ConfigParser.ConfigParser();
cfg.read('config.cfg');

META_LEVELDB = leveldb.LevelDB( cfg.get('main','meta_leveldb_loc') );
CONTENT_LEVELDB = leveldb.LevelDB( cfg.get('main','content_leveldb_loc') );
PUBMED_CONTENT_LEVELDB = leveldb.LevelDB( cfg.get('main','pubmed_content_leveldb_loc') );
findAllNode(META_LEVELDB, 0, 0);
fout = open("search_candid.dat","w")
for word in lexicon.keys():
	mindepth = 100;
	result = 0;
	maxsize = 0;
	for candid in lexicon[word]:
		if ((deep[candid] == mindepth) and (size[candid] > maxsize)):
			maxsize = size[candid];
			result = candid;
		if (deep[candid] < mindepth):
			result = candid;
			mindepth = deep[candid];
			maxsize = size[candid];

	fout.write(str(word) + '\t' + str(result) + '\n');


	
