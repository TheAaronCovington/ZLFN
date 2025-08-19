# AI-Styled Propositional Logic Demo

This document demonstrates the **futuristic AI theme** with advanced logic styling and glowing effects.

## Logical Operators and Propositions

Let's examine some fundamental logical expressions:

### Basic Logical Operators

- **Conjunction**: <span class="logic-term">∧</span> (AND)
- **Disjunction**: <span class="logic-term">∨</span> (OR) 
- **Implication**: <span class="logic-term">→</span> (IF-THEN)
- **Biconditional**: <span class="logic-term">↔</span> (IF AND ONLY IF)
- **Negation**: <span class="logic-term">¬</span> (NOT)

### Complex Logical Expressions

Consider the following propositional logic statement:

> **Modus Ponens**: If we have <span class="logic-term">P → Q</span> and <span class="logic-term">P</span>, then we can derive <span class="logic-term">Q</span>.

Here's a more complex example:

**De Morgan's Law**: <span class="logic-term">¬(P ∧ Q) ↔ (¬P ∨ ¬Q)</span>

```expression
(P ∧ (P → Q)) → Q
```

```expression
(¬Q ∧ (P → Q)) → ¬P
```

### Truth Table Example

| P | Q | P ∧ Q | P ∨ Q | P → Q | ¬P |
|---|---|-------|-------|-------|-----|
| T | T | T     | T     | T     | F   |
| T | F | F     | T     | F     | F   |
| F | T | F     | T     | T     | T   |
| F | F | F     | F     | T     | T   |

## Advanced Logical Reasoning

### Argument: Transcendental Argument for God (TAG)

The **Transcendental Argument for God (TAG)** is a **transcendental** argument that can be formalized as:

1. **Premise 1**: Logic and reasoning exist and are meaningful
2. **Premise 2**: For logic to be meaningful, it must have an ultimate foundation  
3. **Premise 3**: Only God can provide the ultimate foundation for logic
4. **Conclusion**: Therefore, God exists

```expression
(Logic_Exists ∧ (Logic_Exists → Need_Foundation) ∧ (Need_Foundation → God_Provides)) → God_Exists
```

However, the logical flaw lies in establishing the truth of **Premise 3**.

### Argument: Classical Modus Ponens

A simple **deductive** argument demonstrating modus ponens:

1. **Premise 1**: If it is raining, then the ground is wet
2. **Premise 2**: It is raining  
3. **Conclusion**: Therefore, the ground is wet

```expression
(Raining → Ground_Wet) ∧ Raining → Ground_Wet
```

This argument is **valid** and demonstrates the logical rule of modus ponens.

### Code Example: Logic Parser

```typescript
interface LogicalExpression {
  operator: 'AND' | 'OR' | 'IMPLIES' | 'NOT';
  left?: LogicalExpression | Proposition;
  right?: LogicalExpression | Proposition;
}

class LogicalReasoner {
  evaluate(expr: LogicalExpression, truth_assignment: Map<string, boolean>): boolean {
    switch (expr.operator) {
      case 'AND':
        return this.evaluate(expr.left!, truth_assignment) && 
               this.evaluate(expr.right!, truth_assignment);
      case 'OR':
        return this.evaluate(expr.left!, truth_assignment) || 
               this.evaluate(expr.right!, truth_assignment);
      case 'IMPLIES':
        return !this.evaluate(expr.left!, truth_assignment) || 
               this.evaluate(expr.right!, truth_assignment);
      case 'NOT':
        return !this.evaluate(expr.left!, truth_assignment);
    }
  }
}
```

### Philosophical Implications

The relationship between logic and existence can be expressed as:

<span class="logic-term">∀P (Meaningful(P) → ∃Logic_System(validates(P)))</span>

This suggests that **meaningful propositions presuppose logical frameworks**, but does not necessitate a divine grounding.

## Interactive Elements

Hover over any <span class="logic-term">logical operator</span> to see the **glowing effect** in action!

The AI theme provides:

- **Neon cyan** highlights for logical terms
- **Smooth animations** on all interactive elements  
- **Futuristic glow effects** throughout the interface
- **Responsive design** that adapts to all screen sizes

---

*This document showcases the complete AI dark theme with sophisticated visual effects, perfect for presenting complex logical arguments in a modern, engaging interface.*

