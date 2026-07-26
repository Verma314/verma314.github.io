---
layout: post
title:  "Spec Faithfulness"
date:   2026-07-22 00:00:00 +0100
categories: books
---





1. RQ1: How do we measure 'faithfulness' of a formal spec against human intent? [non human-in-the-loop]

The human is definitely the ultimate oracle; however, does a partial or non-human/AI oracles exist that can capture how well a spec captures the intent without human involvement? How do we minimize human-in-the-loop? Especially with improving LLM performance can they act as a substitute for human-in-the-loop approaches?



- survey existing methods and what they used.
- critique whether those methods are robust
- propose a method [??]

How to test an oracle:
"Take requirements with trusted gold specs, inject controlled unfaithfulness (boundary shifts, quantifier swaps, dropped conjuncts, antecedent weakening, off-by-one in temporal operators), and measure each candidate oracle's detection rate and false-alarm rate against these known-bad mutants"


2. RQ2: How do we measure and reduce vagueness and ambiguity in human NL requirements to aid the reliable generation of LLM-assited formal specs.

( Alt-RQ3: How can we with human+LLM collaboration, best capture human intent in formal spec? [human-in-the-loop] )



-----


1. RQx: What target formalism (Lean, Dafny, TLA+ etc) is best suited to capture human intent to formal spec. Which shows the best accuracy and reliabily for LLM-assisted formally verified software development? 


----


