import json
T={}
for fn in ['ui.tsv','banks.tsv']:
    for l in open(fn,encoding='utf-8'):
        l=l.rstrip('\n')
        if l: ru,uk,en=l.split('\t'); T[ru]=(uk,en)
extra_en=dict(zip('АБВГДЕЖЗИК','ABCDEFGHIJ')); extra_en['Я']='Z'
for L,i in (('uk',0),('en',1)):
    d={k:v[i] for k,v in T.items() if v[i]!=k}
    if L=='en': d.update(extra_en)
    open(f'../i18n-{L}.js','w',encoding='utf-8').write('/* Перевод интерфейса: русская фраза → '+L+'. Создаётся из таблицы переводов. */\nwindow.I18N_D='+json.dumps(d,ensure_ascii=False,separators=(',',':'))+';\n')
    print(L,len(d))
