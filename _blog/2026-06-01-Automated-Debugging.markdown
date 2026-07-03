---
layout: post
title:  "Automated Debugging"
date:   2026-06-01 19:59:00 +0100
categories: books
---

## Debugging loop:

'generate' and test\

![alt text](/blog/image-2.png)
Creation of the baseline reproduction scenario; and then iterative hypothesis and test.
1. requires a fixed testable defect reproduction:
Case A - ie a spec/description for the senario when done that causes the defect to show up.
Case B - a spec/description for the scenario where the defect does not show up.
 
2. The LLM by default shoul be able to keep repeating and experimenting on Case A;  'B' becomes the case.

This is quite similar to how humans debug: they reproduce the erroneous scenario (Case A). Figure out what the correct scenario would look like. And then come up with reasons on why Case A might be happenin and how to resolve it to Case B, and then try various hypothesis/ideas until B becomes the C.

## Reasoning/Grounding

For the LLM to become aware of the architecte, several approaches can be used:
1. Specific skill files which 'teach' the LLM about the connector.
2. A pre-computed typed knowledge graph of the architecture of the plugin, stored in the DB or a relational format. 
3. Other structured knowledge such as DB tables with useful information.
4. Others ... ?

