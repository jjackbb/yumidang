with open('docs/design/yumidang-wireframes.html', 'r', encoding='utf-8') as f:
    html = f.read()

bad_str = """    }).join("")
            + '</div><p class="cap" style="margin:4px 0 0">누르면 입력창에 채워져요. 바로 전송되지 않아요.</p></div>'
          : '')
        + '<div class="composer">'
          + (st === "confirmed" ? '<button class="ico" aria-label="일정 변경 제안" data-state="proposal">일정</button>' : '')
          + '<input class="inp" data-fs="s11msg" data-chatinput="1" value="' + esc(v("s11msg")) + '" placeholder="메시지를 입력하세요" />'
          + '<button class="sendbtn" data-act="send">전송</button></div>';"""

print("Found bad string:", bad_str in html)
html = html.replace(bad_str, "")

with open('docs/design/yumidang-wireframes.html', 'w', encoding='utf-8') as f:
    f.write(html)
