export const processShaderCompilationErrors = async (shader: string, shaderModule: GPUShaderModule) => {
  const compilationInfo = await shaderModule.getCompilationInfo();

  if (compilationInfo.messages.length > 0) {
    console.group('Shader Compilation Messages:');

    for (const message of compilationInfo.messages) {
      const messageType = message.type;
      const lineNum = message.lineNum;
      const linePos = message.linePos;
      const messageText = message.message;

      const location = lineNum !== undefined ? `:${lineNum}:${linePos ?? 0}` : '';
      const fullMessage = `${messageType}${location}: ${messageText}`;

      if (messageType === 'error') {
        console.error(fullMessage);
      } else if (messageType === 'warning') {
        console.warn(fullMessage);
      } else {
        console.info(fullMessage);
      }

      if (lineNum !== undefined) {
        const lines = shader.split('\n');
        const relevantLine = lines[lineNum - 1];
        if (relevantLine) {
          console.log(`  | ${relevantLine}`);
          if (linePos !== undefined) {
            console.log(`  | ${' '.repeat(linePos)}^`);
          }
        }
      }
    }

    console.groupEnd();

    const hasErrors = compilationInfo.messages.some(m => m.type === 'error');

    if (hasErrors) {
      throw new Error('Shader compilation failed. See console for details.');
    }
  }
}
