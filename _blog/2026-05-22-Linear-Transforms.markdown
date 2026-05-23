---
layout: post
title:  "Intuition on Linear Transforms, Linear Independence, Matrices, and Null Space"
date:   2026-05-22 13:00:00 +0100
categories: books
---

## Linear Transforms

A linear transform (or linear map) from V to W is a function T : V -> W satisfying two properties:
1. **Additivity**: T(u + v) = T(u) + T(v)
2. **Homogeneity**: T(cv) = cT(v), for all c in field F

Intuition: any function between two vector spaces that preserves addition and scalar multiplication.

## Linear Transforms and Matrices

A matrix can be interpreted as a linear transform.

A 2x2 matrix represents where the basis vectors from vector space A would land in vector space B. If in A we have an element x represented as:

```
x = a1 * [basis_vector_1] + a2 * [basis_vector_2]
```

then applying the transformation T gives us:

```
T(x) = a1 * [column 1 of the matrix] + a2 * [column 2 of the matrix]
```

*Example* 

Consider a linear map $T : \mathbb{R}^2 \to \mathbb{R}^2$ represented by the matrix:

$$M = \begin{pmatrix} 2 & 1 \\ 0 & 3 \end{pmatrix}$$

The columns tell us where the standard basis vectors (1 0) and (0 1) land:

$$T(e_1) = \begin{pmatrix} 2 \\ 0 \end{pmatrix}, \quad T(e_2) = \begin{pmatrix} 1 \\ 3 \end{pmatrix}$$

Now take a vector $x = 3e_1 + 2e_2 = \begin{pmatrix} 3 \\ 2 \end{pmatrix}$. Applying T:

$$T(x) = 3 \cdot \begin{pmatrix} 2 \\ 0 \end{pmatrix} + 2 \cdot \begin{pmatrix} 1 \\ 3 \end{pmatrix} = \begin{pmatrix} 6 \\ 0 \end{pmatrix} + \begin{pmatrix} 2 \\ 6 \end{pmatrix} = \begin{pmatrix} 8 \\ 6 \end{pmatrix}$$

The coefficients (3 and 2) stayed the same in the transform. The matrix tells new destinations for each basis vector from the orignal list.

Again, each column of the matrix is where one basis vector lands after the transformation. The matrix just tells us the new destinations.

An m x n matrix represents a linear map from an n-dimensional space to an m-dimensional space. Column j is where the j-th basis vector gets sent.

*A direct example from Axler*

linear maps from $\mathbf{F}^n$ to $\mathbf{F}^m$

To generalize, let $m$ and $n$ be positive integers, let $A_{j,k} \in \mathbf{F}$ for each $j = 1, \ldots, m$ and each $k = 1, \ldots, n$, and define a linear map $T \in \mathcal{L}(\mathbf{F}^n, \mathbf{F}^m)$ by:

$$T(x_1, \ldots, x_n) = (A_{1,1}x_1 + \cdots + A_{1,n}x_n, \;\ldots\;, A_{m,1}x_1 + \cdots + A_{m,n}x_n)$$

In fact, every linear map from $\mathbf{F}^n$ to $\mathbf{F}^m$ is of this form.


*Another practical example: Neural Nets*

In neural networks, a layer computes something like $y = \sigma(Wx + b)$, where $W$ is a weight matrix, $b$ is a bias, and $\sigma$ is an activation function (like ReLU). The $Wx$ part is a linear transform, the weight matrix $W$ (the transform) maps the input (vectors from space n) from one space to another, exactly as above. The bias and activation function break linearity (otherwise stacking layers would collapse into a single linear map, and the network couldn't learn anything interesting).


## Null Space and Linear Independence

Say we want to figure out whether a list of vectors w1, w2, w3 is linearly independent.

By definition, the vectors are linearly independent if the only solution to:

```
a1*w1 + a2*w2 + a3*w3 = 0
```

is a1 = a2 = a3 = 0.

Now here is the trick: we can represent this set of vectors as a 'linear transform', and hence as a matrix. We *construct* a linear map T by placing w1, w2, w3 as the columns of a matrix. From what we know about matrices, this means:

```
T([a1, a2, a3]) = a1*w1 + a2*w2 + a3*w3
```

Looking at the right-hand side: that is exactly the linear combination from the independence definition!

So the question "are these vectors linearly independent?" becomes: **which inputs from the initial vector space does T send to the zero vector?
Is it only the zero vector itself?

A linear map moves vectors from one space to another. The **null space** of T is the set of all inputs that get sent to zero:

```
null(T) = { v in V : T(v) = 0 }
```

If the null space is just {0} i.e.,   only the zero vector gets mapped to zero, then the only solution to our linear combination equation is the trivial one, and the vectors are linearly independent.

If the null space contains anything else (for example: some nonzero [a1, a2, a3] that T maps to zero) then we have found a nontrivial linear combination that equals zero, and the vectors are linearly dependent.

The list of vectors is not inherently a transform. We *chose* to build a transform from them because it reframes the independence question into a null space question, which is a standard  technique.



## Julia program to test linear independence of any list of vectors


```
using LinearAlgebra

# Linear Independence
# A list of vectors v1, v2, ..., vn is linearly independent if the only
# solution to a1*v1 + a2*v2 + ... + an*vn = 0 is a1 = a2 = ... = an = 0.

# --- Test vectors in R^3 ---
# These should be linearly independent
v1 = [1, 0, 0]
v2 = [0, 1, 0]
v3 = [0, 0, 1]

# These should be linearly dependent (v3 = v1 + v2)
w1 = [1, 2, 3]
w2 = [4, 5, 6]
w3 = [5, 7, 9]

function is_linear_independent( vectors... )
    # build a linear transform
    T = hcat(vectors...)
    nullSpace = nullspace(T)
    if ( iszero(nullSpace) )
        return true
    else
        return false
    end
end

println(is_linear_independent(v1, v2, v3))
println(is_linear_independent(w1, w2, w3))

```

## A simple julia program to test if a map between two vector spaces is linear (using numerial and symbolic computation)

```
using LinearAlgebra
using Random
using Symbolics

# --- Define your maps here ---

# T should take a vector and return a vector
function T(v; b=0, c=0)
    # TODO: implement the map T(x,y,z) = (2x - 4y + 3z + b, 6x + cxyz)
    x = v[1]
    y = v[2]
    z = v[3]
    return [2*x - 4*y + 3*z + b, 6*x + (c * x * y * z)] 
end

# --- Numerical check (random vectors) ---
# Check if a map is linear by testing additivity and homogeneity
function is_linear_numerical(map; num_tests=100, tol=1e-10)
    # TODO: generate random vectors and scalars
    # TODO: test additivity:   map(v1 + v2) ≈ map(v1) + map(v2)
    # TODO: test homogeneity:  map(λ * v) ≈ λ * map(v)    
    for i = 1:num_tests
        randomV1 = [rand(-1000:1000), rand(-1000:1000), rand(-1000:1000)]
        randomV2 = [rand(-1000:1000), rand(-1000:1000), rand(-1000:1000)]
    
        leftCommute = map(randomV1 + randomV2)
        rightCommute = map(randomV1) + map(randomV2)

        #homegeneity:
        lam = rand(-1000:1000)
        leftHomogen = map( lam * randomV1)
        rightHomogen = lam * map(randomV1)

        if ((leftCommute != rightCommute) || (leftHomogen !=rightHomogen))
            return false
        end
    end

    return true
end


map1 =  v -> T(v; b=10, c=10) #should be non-linear
map2 = v -> T(v; b=0, c = 0) # should be linear

#println( is_linear_numerical(map1))
#println( is_linear_numerical(map2))


# --- Symbolic check (proof) ---

# Check if a map is linear by testing additivity and homogeneity
# symbolically. Returns the simplified residuals so you can see
# exactly what breaks linearity.
function is_linear_symbolic(map, n_in)
    #  create symbolic variables for v1, v2, and λ
    #   use @variables x1, x2, ...  or use Symbolics.variable(:x, i)
    #  compute additivity residual:   simplify.(map(v1 + v2) - (map(v1) + map(v2)))
    # compute homogeneity residual:  simplify.(map(λ * v) - λ * map(v))
    #  return whether both residuals are zero, and the residuals themselvesi
    
    @variables x1 x2 x3 y1 y2 y3 lam
    leftCommute  = map( [x1, x2, x3] + [y1, y2,y3])
    rightCommute = map([x1, x2, x3]) + map([y1, y2, y3])
    
    vector1 = [x1, x2, x3]
    homogeneityTest = simplify.(expand.(map(lam * vector1) - (lam* map(vector1))))
    additivityTest = simplify.(leftCommute - rightCommute)
    if (iszero(additivityTest) && iszero(homogeneityTest)) 
        return true
    end    
    return false
end

map3 =  v -> T(v; b=10, c=10) #should be non-linear
map4 = v -> T(v; b=0, c = 0) # should be linear
println( is_linear_symbolic(map3, 0))
println( is_linear_symbolic(map4, 0 ))

# --- Matrix extraction ---

# Extract the matrix representation of a linear map
# by applying it to standard basis vectors
function extract_matrix(map, n_in, n_out)
    # TODO: build the matrix column by column using basis vectors e1, e2, ...
end
```

