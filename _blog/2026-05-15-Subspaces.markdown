---
layout: post
title:  "Subspaces"
date:   2026-05-15 18:30:00 +0100
categories: books
---

## Subspaces: Definition

A subset $$U$$ of a vector space $$V$$ is called a **subspace** of $$V$$ if
$$U$$ is itself a vector space using the same addition and scalar multiplication
as $$V$$.

In practice, we do not need to check all the vector space axioms again. From Axler:

#### Conditions for a Subspace

Let $$V$$ be a vector space over a field $$\mathbb{F}$$, and let $$U \subseteq V$$.
Then $$U$$ is a subspace of $$V$$ if and only if the following three conditions hold:

$$
\begin{aligned}
&\text{additive identity:}
&& 0 \in U, \\
&\text{closed under addition:}
&& u, w \in U \implies u + w \in U, \\
&\text{closed under scalar multiplication:}
&& a \in \mathbb{F} \text{ and } u \in U \implies au \in U.
\end{aligned}
$$

#### Proof

Think about why we don't need to show that in $$U$$ other properties of vector spaces also hold.


## Examples of Subspaces (from Axler)

### 1. A subset of $$\mathbb{F}^4$$

If $$b \in \mathbb{F}$$, then

$$ \{(x_1, x_2, x_3, x_4) \in \mathbb{F}^4 : x_3 = 5x_4 + b\} $$

is a subspace of $$\mathbb{F}^4$$ if and only if $$b = 0$$.

Why: the zero vector $$(0,0,0,0)$$ can be in this set only if

$$ 0 = 5(0) + b, $$

which means $$b = 0$$.

### 2. Continuous functions on $$[0,1]$$

The set of continuous real-valued functions on the interval $$[0,1]$$ is a
subspace of $$\mathbb{R}^{[0,1]}$$.

Note: $$A^B$$, such as $$\mathbb{R}^{[0,1]}$$, means the set of functions from
$$B$$ to $$A$$.

### 3. Differentiable functions on $$\mathbb{R}$$

The set of differentiable real-valued functions on $$\mathbb{R}$$ is a
subspace of $$\mathbb{R}^{\mathbb{R}}$$.

### 4. Differentiable functions with $$f'(2) = b$$

The set of differentiable real-valued functions $$f$$ on the interval $$(0,3)$$
such that

$$ f'(2) = b $$

is a subspace of $$\mathbb{R}^{(0,3)}$$ if and only if $$b = 0$$.

Why? 

Define $$ S_b = \{f : (0,3) \to \mathbb{R} : f \text{ is differentiable and } f'(2) = b\}. $$

For $$S_b$$ to be a subspace, it must contain the zero function. The zero function is

$$ 0(x) = 0. $$

Therefore,

$$ 0'(x) = 0, $$

so in particular

$$ 0'(2) = 0. $$

Thus the zero function belongs to $$S_b$$ only when $$b = 0$$.

### 5. Subspaces of $$\mathbb{R}^2$$

The subspaces of $$\mathbb{R}^2$$ are exactly $$ \{0\}, \quad \mathbb{R}^2, $$ and all lines in $$\mathbb{R}^2$$ passing through the origin.

### 6. Subspaces of $$\mathbb{R}^3$$

The subspaces of $$\mathbb{R}^3$$ are exactly $$ \{0\}, \quad \mathbb{R}^3, $$ all lines in $$\mathbb{R}^3$$ passing through the origin, and all planes in $$\mathbb{R}^3$$ passing through the origin.
