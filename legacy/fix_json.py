#!/usr/bin/env python3
"""
修复 index.html 中的 EMBEDDED_DATA JSON 格式问题
问题：JSON 对象中包含实际的换行符和控制字符，需要先清理再解析
"""
import json
import re

def fix_html():
    print("📖 读取 index.html...")
    with open('index.html', 'r', encoding='utf-8') as f:
        content = f.read()

    # 查找 const EMBEDDED_DATA = {...};
    pattern = r'const EMBEDDED_DATA = (\{.+?\});'
    match = re.search(pattern, content, re.DOTALL)

    if not match:
        print("❌ 未找到 EMBEDDED_DATA 定义")
        return False

    json_str = match.group(1)
    print(f"📋 找到 EMBEDDED_DATA，长度: {len(json_str)} 字符")

    # 检查是否包含裸换行符
    newline_count = json_str.count('\n')
    print(f"⚠️  发现 {newline_count} 个裸换行符")

    # 方法：使用正则表达式将字符串值中的实际换行符替换为 \n
    # 先尝试直接清理
    print("\n🔧 清理裸换行符和控制字符...")

    # 将所有实际换行符和回车符替换为空格
    cleaned = json_str.replace('\n', ' ').replace('\r', ' ').replace('\t', ' ')

    # 压缩多余空格
    cleaned = re.sub(r'\s+', ' ', cleaned)

    print(f"   清理后长度: {len(cleaned)} 字符")

    # 尝试解析清理后的 JSON
    try:
        data = json.loads(cleaned)
        print(f"✅ JSON 解析成功！")
        print(f"   - 博物馆数量: {len(data.get('museums', []))}")
        print(f"   - 朝代数量: {len(data.get('dynasties', []))}")
        print(f"   - 事件数量: {len(data.get('events', []))}")

    except json.JSONDecodeError as e:
        print(f"❌ JSON 解析仍然失败: {e}")
        print(f"   错误位置: 行 {e.lineno}，列 {e.colno}")

        # 尝试找到错误位置的上下文
        error_pos = e.pos if hasattr(e, 'pos') else 51593
        start = max(0, error_pos - 50)
        end = min(len(cleaned), error_pos + 50)
        print(f"\n   错误位置上下文:")
        print(f"   ...{cleaned[start:end]}...")

        return False

    # 将 JSON 压缩为单行（无缩进），确保所有换行符都正确转义
    print("\n📦 重新序列化为标准 JSON...")
    compact_json = json.dumps(data, ensure_ascii=False, separators=(',', ':'))
    print(f"   最终 JSON 长度: {len(compact_json)} 字符")

    # 替换原内容中的 JSON
    print("\n💾 写入修复后的文件...")
    new_content = content[:match.start(1)] + compact_json + content[match.end(1):]

    with open('index.html', 'w', encoding='utf-8') as f:
        f.write(new_content)

    print(f"✅ 已修复 index.html")

    # 验证修复后的文件
    print("\n🔍 验证修复结果...")
    with open('index.html', 'r', encoding='utf-8') as f:
        new_html = f.read()

    new_match = re.search(pattern, new_html, re.DOTALL)
    if new_match:
        new_json_str = new_match.group(1)
        # 检查新的 JSON 中是否还有裸换行符
        new_newline_count = new_json_str.count('\n')
        print(f"   新 JSON 中的换行符数量: {new_newline_count}")

        try:
            verified_data = json.loads(new_json_str)
            print("✅ 修复后的 JSON 验证通过！")
            print(f"   - 博物馆数量: {len(verified_data.get('museums', []))}")
            print(f"   - 朝代数量: {len(verified_data.get('dynasties', []))}")
            print(f"   - 事件数量: {len(verified_data.get('events', []))}")
            return True
        except json.JSONDecodeError as e:
            print(f"❌ 修复后的 JSON 仍然无效: {e}")
            return False
    else:
        print("❌ 验证时未找到 EMBEDDED_DATA")
        return False

if __name__ == '__main__':
    import os
    os.chdir('/Users/xian/.openclaw/workspace/museum-map')
    success = fix_html()
    print("\n" + "="*50)
    if success:
        print("🎉 修复成功！")
    else:
        print("💥 修复失败")
    exit(0 if success else 1)
