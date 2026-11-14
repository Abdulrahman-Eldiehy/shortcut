import re,sys
src,out=sys.argv[1],sys.argv[2]
s=open(src,encoding='utf-8').read()
tr=str.maketrans('0123456789%','٠١٢٣٤٥٦٧٨٩٪')
out_parts=[];i=0;skip=0;in_style=False
for m in re.finditer(r'<[^>]+>|[^<]+',s):
    t=m.group(0)
    if t.startswith('<'):
        tl=t.lower()
        if tl.startswith('<style') or tl.startswith('<script'): in_style=True
        elif tl.startswith('</style') or tl.startswith('</script'): in_style=False
        elif tl.startswith('<bdi'): skip+=1
        elif tl.startswith('</bdi'): skip-=1
        out_parts.append(t)
    else:
        if in_style or skip or 'body' not in ''.join(out_parts[-1:]) and False: out_parts.append(t)
        else: out_parts.append(t if in_style or skip else t.translate(tr))
html=''.join(out_parts)
# لا نحول ما قبل body (العنوان فقط)
open(out,'w',encoding='utf-8').write(html)
