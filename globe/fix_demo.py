#!/usr/bin/env python3
"""Fix demo articles to only use climate summit articles"""

import re

# Read the file
with open('run_pipeline.py', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Find and replace the Ukraine article
output_lines = []
i = 0
while i < len(lines):
    if 'The Russo-Ukrainian War' in lines[i]:
        # Found the Ukraine article, skip it and replace with climate article
        # Find the closing bracket for this dict entry
        indent_level = len(lines[i]) - len(lines[i].lstrip())
        
        # Skip until we find the closing },
        while i < len(lines):
            output_lines.append(lines[i])
            if lines[i].strip() == '},':
                # Found the end, now replace
                output_lines.pop()  # Remove the closing },
                output_lines.pop()  # Remove the last line
                output_lines.pop()  # Remove some more context
                
                # Add the new climate article
                new_article = '''    {
        "title":        "UN Climate Summit Geneva reaches historic emission deal",
        "url":          "https://example.com/climate-summit-2026-en",
        "source":       "Reuters",
        "published_at": "2026-06-03",
        "text": """
GENEVA — In a landmark moment for international climate diplomacy, world leaders concluded the UN Climate Summit in Geneva today with a historic agreement that commits signatory nations to slashing global carbon emissions by 50 percent before 2035.

180 Nations Commit to 50% Carbon Reduction by 2035; $500 Billion Green Transition Fund Established

The agreement marks unprecedented cooperation between developed and developing nations. Key elements include:

A $500 billion Green Transition Fund to support clean energy infrastructure in developing nations. The fund will finance renewable energy projects, clean technology transfer, transport electrification and sustainable industrial conversion in coal-dependent countries.

A Loss and Damage fund that will disburse $50 billion annually beginning in 2026 to compensate vulnerable nations already experiencing climate impacts.

Signatory nations must submit detailed national implementation plans within 18 months, with the first progress review scheduled for the 2028 UN Climate Summit in Nairobi.

The agreement's announcement carried particular symbolic weight as it was jointly presented by US President Jane Smith and Chinese Premier Li Wei, representing the world's two largest economies and greenhouse gas emitters.

President Smith described the agreement as demonstrating that "even our most complex geopolitical relationships can converge when the survival of our planet is at stake."

Premier Li emphasized that the deal reflects a "shared human destiny" that transcends national borders and economic competition.

Energy analysts note that achieving the 2035 target will require accelerating the global deployment of renewable energy by approximately 400 percent compared to current rates.

Climate scientists have calculated that if fully implemented, the Geneva agreement could limit global warming to about 1.7 degrees Celsius above pre-industrial levels, approaching the aspirational threshold of 1.5 degrees set in the Paris Agreement.

The $500 billion Green Transition Fund, while unprecedented in scale, represents only a fraction of the estimated $2.4 trillion annually that developing nations require to transition their economies while meeting growing energy demands.
        """,
    },
'''
                output_lines.extend(new_article.split('\n'))
                break
            i += 1
        i += 1
    else:
        output_lines.append(lines[i])
        i += 1

# Write back
with open('run_pipeline.py', 'w', encoding='utf-8') as f:
    f.writelines(output_lines)

print("✓ Demo articles fixed: Ukraine war replaced with climate summit article")
