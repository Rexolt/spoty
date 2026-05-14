/**
 * Sandboxed expression evaluator for the calculator feature.
 * Replaces unsafe `Function()`/`eval()`. Supports + - * / % and grouping.
 */
export function safeEvaluateMath(expr: string): number | null {
  // Support scientific notation, decimals starting with '.', and the exponentiation operator '**' or '^'.
  const tokens = expr.match(/(\d*\.?\d+(?:[eE][+-]?\d+)?|\*\*|[+\-*/%()^])/g);
  if (!tokens) return null;

  const cleaned = tokens.join('');
  // Validate characters — '^' is mapped to '**' during execution if we use eval-like logic,
  // but here we manually parse.
  if (!/^[\d+\-*/%().^eE+-]+$/.test(cleaned)) return null;

  let pos = 0;

  function parseExpression(): number {
    let result = parseTerm();
    while (pos < tokens!.length && (tokens![pos] === '+' || tokens![pos] === '-')) {
      const op = tokens![pos++];
      const right = parseTerm();
      result = op === '+' ? result + right : result - right;
    }
    return result;
  }

  function parseTerm(): number {
    let result = parsePower();
    while (
      pos < tokens!.length &&
      (tokens![pos] === '*' || tokens![pos] === '/' || tokens![pos] === '%')
    ) {
      const op = tokens![pos++];
      const right = parsePower();
      if (op === '*') result *= right;
      else if (op === '/') {
        if (right === 0) throw new Error('Division by zero');
        result /= right;
      } else {
        result %= right;
      }
    }
    return result;
  }

  function parsePower(): number {
    let result = parseFactor();
    while (pos < tokens!.length && (tokens![pos] === '**' || tokens![pos] === '^')) {
      pos++;
      const right = parsePower(); // Right-associative
      result = Math.pow(result, right);
    }
    return result;
  }

  function parseFactor(): number {
    if (pos >= tokens!.length) throw new Error('Unexpected end of expression');

    if (tokens![pos] === '-') {
      pos++;
      return -parseFactor();
    }
    if (tokens![pos] === '+') {
      pos++;
      return parseFactor();
    }
    if (tokens![pos] === '(') {
      pos++;
      const result = parseExpression();
      if (tokens![pos] !== ')') throw new Error('Mismatched parentheses');
      pos++;
      return result;
    }
    const num = parseFloat(tokens![pos]);
    if (isNaN(num)) throw new Error('Invalid token');
    pos++;
    return num;
  }

  try {
    const result = parseExpression();
    if (pos !== tokens.length || !Number.isFinite(result)) return null;
    return result;
  } catch {
    return null;
  }
}

