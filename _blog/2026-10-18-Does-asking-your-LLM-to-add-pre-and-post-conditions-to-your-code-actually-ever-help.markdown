---
layout: post
title:  "Does asking your LLM to add pre-and-post-conditions to your code actually ever help?"
date:   2026-10-18 22:13:50 +0100
categories: books
---

So far:
1. Asking an LLM just for the implementation is quite efficient. The results here were 144/164 -- 87.8%

2. Asking an LLM for implementation --> then asking for a spec --> then model checking the implementation/spec --> allowing the LLM to modify either implementation or spec, seems to give modest improvements. Overall 150/164 -- 91.46%.


My tests for this on HumanEval+ this paradigm changed the implementation on 22/164 problems (on 11 it changed the implementation while generating the spec; and on 12 problesm after verification failures repairs.one problem appeared in both groups.  Out of 12 repairs-after-verification: 4 were genuine issues that the were helped by model checking). 
