---
layout: post
title:  "AI and Turing Machines"
date:   2026-04-02 13:00:00 +0100
categories: books
---

Research Ppaer: https://onlinelibrary.wiley.com/doi/10.1080/03640210801897856#b20


## P vs NP

* P is the class of 'problems' (or languages) that have polynomial time algorithms

* NP is the class of 'problems' (or languages) that have polynomial time **verifiers**, e.g., hamiltonian path, finding a hamiltonian path is non-poly, but verification of a solution can be done in polynomical time.  Another characterization: is that these problems can be solved in (non-detrministic) polynomial time by a non-deterministic Turing Machine.

Everything that is in P is also in NP.

In summary,

P = the class of languages for which membership can be decided quickly.
NP = the class of languages for which membership can be verified quickly.
P subset of NP.

NP Completeness:

Certain problems in NP show this property that they can be reduced to one another. so if we solve one such problem, all such other problems are solved. So far these have only been problmes not in P.

NP = P ∪ NP-Intermediate ∪ NP-Complete

NP Hard problems may fall outside NP. Although there may be overlap.
NP-Complete = NP ∩ NP-Hard (hard, but at least verifiable)
NP-Hard \ NP = problems that are at least as hard as anything in NP, but aren't even verifiable in poly time.

```
--
NP-Hard
├── NP-Complete (the part inside NP)
└── stuff outside NP entirely (Halting Problem, etc.)

NP
├── P
├── NP-Intermediate
└── NP-Complete (the part inside NP-Hard)
```

----------


### Where do connectionist architectures such as LLMs fall on the classical computational hierarchy?

[The Expressive Power of Transformers with Chain of Thought](https://arxiv.org/abs/2310.07923) describes that with CoT reasoning they fall within P class.

What does this mean? This implies that LLMs even with chain-of-thought reasoning are quite 'weak' (even weaker than Pushdown automata) when being benchmarked against the classical computational models.

todo: read paper and describe the methodology.


### Do brains compute i.e. can brain processes that cause mental phenomenon be reduced to or expressed as computation? 
Yes -- according to the research paper linked about and the Computational Theory of Mind. But how did they get to that conclusion?

https://claude.ai/chat/6c1213f3-bbc0-49cd-882e-384f0c71771f

###  Are there any genuine similarities between brains and neural networks such as LLMs? Where does Dynamical Systems Theory fit in?
https://en.wikipedia.org/wiki/Dynamical_systems_theory


### Simulating Physics/Physical processes vs Simulating "Mathematics"


The Church-Turing-Deutsch thesis says every *physical process* can be simulated by a Turing machine. This is a claim about the physical world: that nature doesn't compute anything a Turing machine can't.

The situation with mathematics is different, Gödel's first incompleteness theorem says that any consistent formal system that strong enough to express basic arithmetic will contain true statements it cannot prove. 


Any formal system (including math) *is* already computational. If we take the axioms and inference rules of ZFC or Peano Arithmetic: we can write a program that mechanically enumerates every theorem. The set of provable theorems is recursively enumerable (it's the output of an algorithm). Formal systems such as mathematics or mathematic theorem-generation are already a Turing machine. 

The problem is that mathematical *truths* can exist beyond a formal system.
"For any consistent formal system F that can do arithmetic, there exist arithmetic statements that are true but not provable in F. You can add that statement as a new axiom to get F', but then F' has its own unprovable truths. This never terminates."

So obviously, there is distinction is between *provability within a system* (computational) and *truth* (not capturable by any single computation at all). There are truths no formal system can reach. (Godel, Turing's Halting Problem etc).

Each formal system (including math) is a computation, but 'truth' still transcends formal systems. Although somehow, 'nature' seems more amneable to being computable.


So, does nature ever 'compute' things that are non-computational? We haven't found it yet. But have we? What about the millions of simulations that would take forever to compute? How do we know that all physical processes can truly be computed? 


*in progress, I will keep thinking about this*