import leveldb;
import ConfigParser;
import json;
timeLine = {};
son = {};
parent = {}
lexicon = {}
size = {}
isLeaf = {}
relate_word = {}
relate_topic = {}
describe = {}
def findAllNode(db, depth, now):
	key = "csxml_children_" + str(now);
	try:
		value = db.Get(key);
	except KeyError:
		value = "";
	data = json.loads(value);
	size[now] = int(data["size"]);
	if (data["isleaf"] == 0):
		for subdata in data["children"]:
			x = subdata["node"];
			desc = subdata["desc"];
			describe[x] = desc;
			for i in range(len(desc)):
				word = desc[i];
				if (not word in lexicon):
					lexicon[word] = [];
				lexicon[word].append(x);
			findAllNode(db, depth + 1, x);



cfg = ConfigParser.ConfigParser();
cfg.read('config.cfg');

META_LEVELDB = leveldb.LevelDB( cfg.get('main','meta_leveldb_loc') );
CONTENT_LEVELDB = leveldb.LevelDB( cfg.get('main','content_leveldb_loc') );
PUBMED_CONTENT_LEVELDB = leveldb.LevelDB( cfg.get('main','pubmed_content_leveldb_loc') );
findAllNode(META_LEVELDB, 0, 0);
fout = open("relate_word.dat","w")
for word in lexicon.keys():
	tmp = {}
	for topic in lexicon[word]:
		for word2 in describe[topic]:
			if (word == word2):
				continue;
			if (not word2 in tmp):
				tmp[word2] = 0;
			tmp[word2] += 1;
	s = sorted(tmp.items(),key=lambda x: x[1], reverse = True);
	fout.write(str(word));
	cnt = 0;
	for item in s:
		if (cnt >= 10):
			break;
		fout.write('\t' + str(item[0]));
		cnt += 1;
	fout.write('\n');


	
