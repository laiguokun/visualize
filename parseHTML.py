from lxml import etree
text = fopen("smaple.html").read();
tree = html.fromstring(text)
target = tree.xpath('//*[@id="topic"]/table/tbody/tr[2]/td[1]')
print(target);
