---
layout: post
title:  "Vector Spaces"
date:   2026-05-15 18:00:00 +0100
categories: books
---

## Vector Spaces

A **vector space** over a field $$\mathbb{F}$$ is a set $$V$$ together with two operations:

$$
\begin{aligned}
+ &: V \times V \to V \\
\cdot &: \mathbb{F} \times V \to V
\end{aligned}
$$

These operations are called **vector addition** and **scalar multiplication**. For every
$$u, v, w \in V$$ and every $$a, b \in \mathbb{F}$$, the following axioms must hold:

$$
\begin{aligned}
u + v &= v + u && \text{commutativity of addition} \\
(u + v) + w &= u + (v + w) && \text{associativity of addition} \\
\exists\,0 \in V \quad \text{such that} \quad v + 0 &= v && \text{additive identity} \\
\forall v \in V,\ \exists\,(-v) \in V \quad \text{such that} \quad v + (-v) &= 0 && \text{additive inverse} \\
a(u + v) &= au + av && \text{distributivity over vector addition} \\
(a + b)v &= av + bv && \text{distributivity over scalar addition} \\
(ab)v &= a(bv) && \text{compatibility of scalar multiplication} \\
1v &= v && \text{scalar identity}
\end{aligned}
$$

Equivalently, $$V$$ forms an abelian group under vector addition, and the scalars come
from a field $$\mathbb{F}$$ whose multiplication acts on the vectors in a way compatible
with both addition in $$V$$ and addition and multiplication in $$\mathbb{F}$$.


Intuitively, $$V$$ has elements that can combine to form other $$V$$ elements, and can get 'scaled' up or down using elements from a field/scalar. 



## Examples of Vector Spaces

The usual example of a vector space is $$\mathbb{R}^n$$. For example,

$$
\mathbb{R}^2 = \{(x, y) : x, y \in \mathbb{R}\}
$$

is the set of all ordered pairs of real numbers. We add vectors component by component:

$$
(x_1, y_1) + (x_2, y_2) = (x_1 + x_2, y_1 + y_2)
$$

and we multiply by scalars component by component:

$$
a(x, y) = (ax, ay)
$$

The intuition is that these vectors can be drawn as arrows in the plane, similar to how it is done in physics.

However, vector spaces are much more general than 'arrows'. A vector is any object that can be added to another object of the same kind, and multiplied by scalars, while satisfying the vector space axioms.

For example, the set of all polynomials with real coefficients is a vector space over
$$\mathbb{R}$$:

$$
\mathbb{R}[x]
$$

An element of this vector space looks like

$$
p(x) = a_0 + a_1x + a_2x^2 + \cdots + a_nx^n
$$

where each coefficient $$a_i$$ is a real number.

We can add two polynomials:

$$
(p + q)(x) = p(x) + q(x)
$$

and we can multiply a polynomial by a scalar:

$$
(ap)(x) = a p(x)
$$

The result is still a polynomial, so the operations stay inside $$\mathbb{R}[x]$$.

For instance, if

$$
p(x) = 1 + 2x
$$

and

$$
q(x) = 3 - x + x^2
$$

then

$$
p(x) + q(x) = 4 + x + x^2
$$

and

$$
5p(x) = 5 + 10x
$$

So the set of polynomials form a vector space as well.

Another example is the set of all $$m \times n$$ matrices over a field $$\mathbb{F}$$:

$$
M_{m \times n}(\mathbb{F})
$$

(The field can be anything, R, C, etc)

Matrices can be added entry by entry, and multiplied by scalars entry by entry. Therefore,
they form a vector space over $$\mathbb{F}$$.

Vector spaces are very general: the vectors might be arrows, lists of numbers,
polynomials, matrices, functions,  or other mathematical objects. The only properties of importance is that they can be added and scaled according to the
vector space axioms.
