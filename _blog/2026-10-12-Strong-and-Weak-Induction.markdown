---
layout: post
title:  "Strong and Weak Induction"
date:   2026-10-12 21:55:46 +0100
categories: books
---

### Strong Induction vs Weak Induction

Ordinary induction, also called weak induction is often used in formal
verification, and is quite straightforward.

*Base Case*
We prove P(0) is true.

*Induction Step*
We assume P(n) is true, and prove P(n+1).

This proof of the induction step and the base case, consequently, show that
P is true for all n.

More formally, with weak induction our task is to create a proof of P(0),
P(k) -> P(k+1). This above proof shows that  'P(n) is true for all n'.

We can write: (P(0)  ∧ ∀ k(P(k) --> P(k+1)) ) --> ∀ n: P(n)

*Now, what is 'strong induction'?*

In strong induction (sometimes called course-of-values induction) instead
of assuming only P(k) as the premise to show P(k+1). We assume P(0) ∧
P(1) ∧.... P(k).  That is, P(k + 1) is true, if everything left of k + 1 is
true as well i.e. P(k), P(k-1)... P(0).

Here too we must prove P(0). The step only concludes P(k+1) for k ≥ 0, so
it gives P(1), P(2), and so on, but never P(0). For example, when k = 0 the
step is P(0) → P(1). It uses P(0) but does not prove it.

Back to strong induction, the task then, becomes to produce a proof
for P(0) ∧ P(1) ∧.... P(k) -> P(k+1); and a proof of P(0). On producing
these,  we know then that P(n) is true for all n.

(P(0) ∧ ∀k (P(0) ∧ … ∧ P(k) → P(k+1))) → ∀n P(n)

**Strong induction is equivalent in power to weak induction.**

The only difference between them is that one or the other might be more
useful for writing a cleaner proof; neither is more powerful than the
other; and are quite the same thing when you think about it. Why?

When we apply weak induction to P, we assume P(k). But we can also apply
weak induction to a **slightly* *different property: one that says all the
P-claims upto k hold.  And use that to show P(k+1), that would **also* *show
that P(n) is true for all n. You didn't do anything radically different;
you just chose a slightly different property to prove.

Take any property P that you're trying to prove. Prove the base case P(0),
then instead of just assuming 'P(k)  is true' for your inductive step. You
assume Q(k) is true, where Q(k) = P(1) ∧ P(2) ... P(k). You have Q(0),
Q(k), and you write a proof for Q(k+1), thus showing Q(n).

----
Quick recap:

In ordinary induction we show P(0), and then given P(k), we prove P(k+1),
showing that p(1), p(2)... etc are all true, ie P(n) is true for all n.

And for strong induction, its quite straightforward as well,

Given P(0), P(1).... P(k) is true, we show P(k+1) is true; and then given a
base case proof say P(0), it becomes obvious that all P(n) is true; because
P(0) being true implies P(1) is true, P(o) and p(1) being true implies P(2)
is true, etc.. thus P(n) is true.
