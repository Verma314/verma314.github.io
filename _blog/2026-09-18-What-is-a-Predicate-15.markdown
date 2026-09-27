---
layout: post
title:  "What is a Predicate?"
date:   2026-09-18 22:00:57 +0100
categories: books
---

"A predicate is a statement with blanks that become true or false when we
fill them in." More formally, a predicate is a symbol that represents a
relation.  $P(a)$ is an atomic formula, where $P$ is the predicate, and $a$ is
"filled" in $P$ the predicate, hence creating a logical formula.

Example, $P$ is a predicate symbol, $>$ is a predicate symbol, but '$x > 0$' is a
predicate.

Predicates are a fundamental notion in first-(and higher)-order-logic,
because they let us open up the atoms, peer inside them. This isn't the
case with propositional logic, over there atoms  can not be peered inside,
'$p$' and '$q$' stand for whole propositions,  i.e., the atoms are indivisible.
Although compound formulae/propositions such as '$p \land q$' are fine for
inspection.

Informally, a predicate is a statement with variables waiting to be filled in. 

$$ P(x) : x > 10 $$

is a predicate expressing a condition on $x$. Once we have $x$, we can evaluate the truth value of $P(15)$, $P(5)$ etc. Although, generally we do need to specify the domain as well.  

Also, we don't always need to specify a value to 'convert' a predicate into a statement. We can also do so by quantifying the variable, for example, this is a statement:

$$ \exists x \in \mathbb{Z}, x > 10 $$

(there exists $x$ in $\mathbb{Z}$, such that $x > 10$)
