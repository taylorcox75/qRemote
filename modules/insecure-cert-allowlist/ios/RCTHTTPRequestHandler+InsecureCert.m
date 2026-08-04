#import "RCTHTTPRequestHandler+InsecureCert.h"
#import "InsecureCertAllowlist-Swift.h"

/**
 * qRemote lets a user opt a specific server into accepting its own
 * self-signed certificate (issue #206) — installing and manually trusting a
 * self-signed cert on iOS trusts it for Safari/WebKit, but React Native's
 * default HTTP handler (RCTHTTPRequestHandler, from React-RCTNetwork) never
 * implements URLSession:task:didReceiveChallenge:completionHandler:, so it
 * always falls through to NSURLSession's default handling with no override
 * point at all — a trusted-on-device cert still gets silently rejected
 * inside the app.
 *
 * This category is the only available hook to change that. It only ever
 * intervenes for NSURLAuthenticationMethodServerTrust challenges against a
 * host the user explicitly opted in (see InsecureCertTrustStore, populated
 * from ServerConfig.allowInsecureCert via services/server-manager.ts). Every
 * other challenge type (Basic Auth, client cert, etc.) and every
 * non-allow-listed host falls through to
 * NSURLSessionAuthChallengePerformDefaultHandling unchanged, so this can't
 * weaken TLS validation for any server the user hasn't explicitly accepted.
 */
@implementation RCTHTTPRequestHandler (InsecureCert)

- (void)URLSession:(NSURLSession *)session
                     task:(NSURLSessionTask *)task
      didReceiveChallenge:(NSURLAuthenticationChallenge *)challenge
        completionHandler:(void (^)(NSURLSessionAuthChallengeDisposition disposition,
                                     NSURLCredential *_Nullable credential))completionHandler
{
  NSString *authMethod = challenge.protectionSpace.authenticationMethod;
  NSString *host = challenge.protectionSpace.host;

  if ([authMethod isEqualToString:NSURLAuthenticationMethodServerTrust] &&
      [InsecureCertTrustStore.shared isHostAllowed:host]) {
    NSURLCredential *credential = [NSURLCredential credentialForTrust:challenge.protectionSpace.serverTrust];
    completionHandler(NSURLSessionAuthChallengeUseCredential, credential);
    return;
  }

  completionHandler(NSURLSessionAuthChallengePerformDefaultHandling, nil);
}

@end
