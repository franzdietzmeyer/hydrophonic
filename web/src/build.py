import pathlib
p=pathlib.Path(__file__).parent
h=(p/'ui.html').read_text()
bio=(p/'bio.js').read_text().replace("if (typeof module !== 'undefined') module.exports","// node export\nif (typeof module !== 'undefined') module.exports")
for tag,f in [('/*__BIO__*/',bio),('/*__DEMO__*/',(p/'demo.js').read_text()),('/*__ENGINE__*/',(p/'engine.js').read_text()+'\n'+(p/'styles_legacy.js').read_text()+'\n'+(p/'styles_new.js').read_text()+'\n'+(p/'styles_more.js').read_text()),('/*__VIZ__*/',(p/'viz.js').read_text()),('/*__APP__*/',(p/'app.js').read_text())]:
    h=h.replace(tag,f)
(p.parent/'index.html').write_text(h)
print(len(h))
