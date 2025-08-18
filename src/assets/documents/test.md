# Test Document with Code Examples

This is a test document to demonstrate the beautiful markdown rendering with syntax highlighting.

## JavaScript Example

```javascript
function transcendentalArgument(premise1, premise2) {
  // A simplified logical structure
  if (premise1.isNecessaryCondition && premise2.exists) {
    return {
      conclusion: premise1.condition + " exists",
      valid: true,
      sound: premise1.isActuallyNecessary && premise2.isActuallyTrue
    };
  }
  return { valid: false, sound: false };
}

// Example usage
const tagArgument = transcendentalArgument(
  { 
    condition: "God", 
    isNecessaryCondition: true, 
    isActuallyNecessary: false // This is where TAG fails
  },
  { 
    exists: true, 
    isActuallyTrue: true 
  }
);

console.log(tagArgument); // { conclusion: "God exists", valid: true, sound: false }
```

## Python Philosophy Logic

```python
class LogicalArgument:
    def __init__(self, premises, conclusion):
        self.premises = premises
        self.conclusion = conclusion
    
    def is_valid(self):
        """Check if conclusion follows from premises"""
        return all(premise.is_true for premise in self.premises)
    
    def is_sound(self):
        """Check if argument is both valid and has true premises"""
        return self.is_valid() and all(premise.is_actually_true for premise in self.premises)

# Critiquing TAG
tag_premises = [
    Premise("God is necessary for logic", is_true=True, is_actually_true=False),
    Premise("Logic exists", is_true=True, is_actually_true=True)
]

tag_argument = LogicalArgument(tag_premises, "Therefore, God exists")
print(f"TAG is valid: {tag_argument.is_valid()}")      # True
print(f"TAG is sound: {tag_argument.is_sound()}")      # False - fails on premise 1
```

## Formal Logic Notation

```
∀x (Necessary(x, Logic) → Exists(x))
Necessary(God, Logic)
∴ Exists(God)

But the issue is proving: Necessary(God, Logic)
```

## SQL Query Example

```sql
SELECT argument_name, is_valid, is_sound, fatal_flaw
FROM philosophical_arguments 
WHERE argument_type = 'Transcendental'
  AND proponent IN ('Jay Dyer', 'Andrew Wilson')
ORDER BY popularity DESC;
```

## CSS Styling

```css
.markdown-content {
  font-family: 'Inter', sans-serif;
  line-height: 1.7;
  color: var(--text-color);
}

.code-block {
  background: #282c34;
  border-radius: 8px;
  padding: 1.2rem;
  overflow-x: auto;
}
```

This demonstrates various programming languages with proper syntax highlighting!

