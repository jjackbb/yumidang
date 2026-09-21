with open('docs/design/yumidang-wireframes.html', 'r', encoding='utf-8') as f:
    html = f.read()

target = "return F({ top: top + action, body:'<div class=\"padx\" style=\"padding-top:8px\">' + msgs + '<div style=\"height:16px\"></div></div>', bot: composer });"

replacement = """var frameHtml = F({ top: top + action, body:'<div class=\"padx\" style=\"padding-top:8px\">' + msgs + '<div style=\"height:16px\"></div></div>', bot: composer });
    var moreSheet = '<div class="sheetwrap" id="moreSheet" style="display:none;z-index:100"><div class="sheet low" style="height:auto">'
      + '<div class="agrp" style="margin:0;border-radius:24px 24px 0 0">'
      + '<div class="ahd">더보기</div>'
      + '<button>신고하기</button>'
      + '<button>차단</button>'
      + '<button data-go="S18">신청 취소</button>'
      + '<button onclick="this.closest(\\' .sheetwrap\\').style.display=\\'none\\'" style="font-weight:700">닫기</button>'
      + '</div></div></div>';
      
    if (st === "proposal") {
      frameHtml += DLG({ title:"일정 변경 제안", body:"상대방이 일정 변경을 제안했어요.<br/>새로운 일정을 확인해 주세요.", btns:'<button class="btn p" onclick="this.closest(\\' .dialog\\').style.display=\\'none\\'">확인</button>' });
    }
    return frameHtml + moreSheet;"""

# Need to be careful with escaping the replace string
if target in html:
    html = html.replace(target, replacement)
    print("Replaced successfully!")
else:
    print("Target not found.")

with open('docs/design/yumidang-wireframes.html', 'w', encoding='utf-8') as f:
    f.write(html)
