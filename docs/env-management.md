# Environment variables management and structure in ELMO(s)
## Overview 
ELMO isolates secrets from casual feature toggles. The secrets are set in the production environment (Portainer), and then translated into PHP variables in env_variables_reader.php

The ordinal feature toggles are defined in feature_flags.php

## Developer experience

settings.php stays untracked (.gitignore), it can overwrite any settings provided in other files for testing and conveniecce in local setup.

## Testing

running Playwrright tests for all the versions requires iterating the versions in one container. To enable this, playwright creates it's own untracked configuration file: 
playwright_variant_lock.php

## Priority loading

the files are loaded in order (first overwrites last):

1. playwright_variant_lock.php (untracked)
2. settings.php (untracked)
3. env_variables_reader.php 
4. feature_flags.php